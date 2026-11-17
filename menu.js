// =========================================================================
// EXPERIENCIA DEL CLIENTE: MENÚ QR, ENCUESTA EXPRESS Y SORTEO VIRAL
// =========================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbysr4bbuBKbkaTNRYuUpe4P1OsuC_qpLAebi-_r_C0NPG9VJwIc4MKbHtmcGh158cBYYQ/exec";
const FACEBOOK_PAGE_URL = "https://www.facebook.com/"; // Coloca aquí el link exacto de @TostaderiaLaCrudita
const FALLBACK_DISH_IMG = "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80";

let menuProducts = JSON.parse(localStorage.getItem("crudita_public_menu")) || [];
let activeCategory = "Todos";
let surveyRating = 5;
let qrOrigin = "Menú QR";

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("origen")) {
        qrOrigin = decodeURIComponent(params.get("origen")).replace(/-/g, " ");
        document.getElementById("qr-origin-badge").innerHTML = `<i class="fa-solid fa-location-dot"></i> ${qrOrigin}`;
    }

    // Si ya había menú guardado en el celular, lo muestra al instante mientras actualiza
    if (menuProducts.length > 0) {
        renderCategories();
        renderClientMenu();
    }

    loadLiveMenu();
});

function switchClientTab(tabName, btn) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    document.querySelectorAll(".client-section").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// =========================================================================
// 1. MENÚ DIGITAL EN TIEMPO REAL DESDE GOOGLE SHEETS
// =========================================================================
async function loadLiveMenu() {
    const grid = document.getElementById("client-menu-grid");
    try {
        // Primero intentamos con getMenuPublico; si Apps Script aún no tiene esa versión, usamos getEstadoCompleto
        let res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMenuPublico&t=${Date.now()}`);
        let data = await res.json();

        if (data.status !== "ok" || !Array.isArray(data.products)) {
            res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getEstadoCompleto&t=${Date.now()}`);
            data = await res.json();
        }

        if (data.status === "ok" && Array.isArray(data.products)) {
            menuProducts = data.products.filter(p => p.active !== false);
            localStorage.setItem("crudita_public_menu", JSON.stringify(menuProducts));
            renderCategories();
            renderClientMenu();
            return;
        }
    } catch (e) {
        console.error("Error cargando menú público:", e);
    }

    if (menuProducts.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-wifi"></i>
                <p>No se pudo conectar con el menú en este momento.</p>
                <button class="btn-retry" onclick="loadLiveMenu()">Reintentar</button>
            </div>
        `;
    }
}

function renderCategories() {
    const cats = ["Todos", ...new Set(menuProducts.map(p => p.category).filter(Boolean))];
    const container = document.getElementById("client-categories");
    container.innerHTML = cats.map(c => `
        <button class="cat-pill ${activeCategory === c ? 'active' : ''}" onclick="selectClientCategory('${c.replace(/'/g, "\\'")}')">${c}</button>
    `).join("");
}

function selectClientCategory(cat) {
    activeCategory = cat;
    renderCategories();
    renderClientMenu();
}

function renderClientMenu() {
    const q = document.getElementById("client-search").value.toLowerCase().trim();
    const grid = document.getElementById("client-menu-grid");

    if (menuProducts.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>Aún no hay platillos registrados en el catálogo.</p></div>`;
        return;
    }

    const filtered = menuProducts.filter(p => {
        const matchCat = activeCategory === "Todos" || p.category === activeCategory;
        const matchText = p.name.toLowerCase().includes(q) || (p.desc && p.desc.toLowerCase().includes(q));
        return matchCat && matchText;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No encontramos platillos con esa búsqueda.</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const imgUrl = (p.image && String(p.image).startsWith("http")) ? p.image : FALLBACK_DISH_IMG;
        return `
            <article class="dish-card" onclick="openDishModal(${p.id})">
                <img src="${imgUrl}" alt="${p.name}" class="dish-thumb" onerror="this.src='${FALLBACK_DISH_IMG}'">
                <div class="dish-info">
                    <div>
                        <span class="dish-tag">${p.category || "Especialidad"}</span>
                        <h3>${p.name}</h3>
                        <p>${p.desc || "Preparado al momento con mariscos frescos de calidad."}</p>
                    </div>
                    <div class="dish-price-row">
                        <span class="dish-price">$${Number(p.price).toFixed(2)}</span>
                        <span class="dish-detail-link">Ver detalle &rarr;</span>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

function openDishModal(id) {
    const p = menuProducts.find(item => Number(item.id) === Number(id));
    if (!p) return;
    const imgUrl = (p.image && String(p.image).startsWith("http")) ? p.image : FALLBACK_DISH_IMG;
    document.getElementById("dm-img").src = imgUrl;
    document.getElementById("dm-cat").innerText = p.category || "Especialidad";
    document.getElementById("dm-title").innerText = p.name;
    document.getElementById("dm-desc").innerText = p.desc || "Especialidad de Tostaderia La Crudita preparada al momento.";
    document.getElementById("dm-price").innerText = `$${Number(p.price).toFixed(2)}`;
    document.getElementById("dish-detail-modal").classList.remove("hidden");
}

function closeDishModal() {
    document.getElementById("dish-detail-modal").classList.add("hidden");
}

// =========================================================================
// 2. DINÁMICA VIRAL "PRESUME TU CRUDITA"
// =========================================================================
async function submitViralEntry(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-submit-viral");
    btn.disabled = true;
    btn.innerText = "Registrando participación...";

    const payload = {
        name: document.getElementById("v-name").value.trim(),
        phone: document.getElementById("v-phone").value.trim(),
        platform: document.getElementById("v-platform").value,
        handle: document.getElementById("v-handle").value.trim(),
        folio: document.getElementById("v-folio").value.trim() || qrOrigin
    };

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "registrarParticipanteViral", payload })
        });
        document.getElementById("viral-form").reset();
        alert("¡Listo! Ya estás participando en la Ruleta Digital de Tostaderia La Crudita. Si resultas ganador, te enviaremos tu cupón único por WhatsApp.");
    } catch (err) {
        alert("Error de conexión. Intenta nuevamente.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Registrarme en la Ruleta`;
    }
}

// =========================================================================
// 3. ENCUESTA DE SATISFACCIÓN EXPRESS (FILTRO INTELIGENTE DE RESEÑAS)
// =========================================================================
function setRating(field, val, btn) {
    surveyRating = val;
    btn.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

async function submitExpressSurvey(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-submit-survey");
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const payload = {
        origin: qrOrigin,
        rating: surveyRating,
        food: document.getElementById("s-food").value,
        speed: document.getElementById("s-speed").value,
        service: document.getElementById("s-speed").value,
        comment: document.getElementById("s-comment").value.trim()
    };

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "guardarEncuesta", payload })
        });

        const resBox = document.getElementById("survey-result-box");
        resBox.classList.remove("hidden", "happy", "alert");

        if (surveyRating >= 4) {
            resBox.classList.add("happy");
            resBox.innerHTML = `
                <h3>¡Muchas gracias por tu ${surveyRating} ⭐!</h3>
                <p style="margin:8px 0 12px; font-size:0.9rem;">Nos alegra que hayas disfrutado tu experiencia. ¿Nos apoyas recomendando nuestra página oficial en Facebook?</p>
                <a href="${FACEBOOK_PAGE_URL}" target="_blank" class="btn-social fb" style="display:inline-flex; padding:12px 20px;">
                    <i class="fa-brands fa-facebook"></i> Recomendar en Facebook
                </a>
            `;
        } else {
            resBox.classList.add("alert");
            resBox.innerHTML = `
                <h3>¡Gracias por tu honestidad!</h3>
                <p style="margin-top:6px; font-size:0.9rem;">Tu reporte llegó directamente a la gerencia de <strong>Tostaderia La Crudita</strong> para atenderlo de inmediato y mejorar nuestro servicio.</p>
            `;
        }

        document.getElementById("survey-form").reset();
    } catch (err) {
        alert("No se pudo enviar la encuesta. Revisa tu conexión.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Evaluación";
    }
}