/* =====================================================================
   SIC | Sistemas Integrales y Consultoría
   Lógica de la landing: preloader, scroll suave, esfera de red en canvas,
   escenas con ScrollTrigger e interacciones.

   Principios:
   - Nada de window.addEventListener('scroll'): todo va con ScrollTrigger,
     IntersectionObserver o eventos de puntero.
   - Si GSAP/ScrollTrigger no cargan, la página sigue siendo 100% usable
     (menú, pestañas, FAQ, formulario, tema, canvas).
   - Respeta prefers-reduced-motion: sin preloader animado, sin pin, sin loops.
   ===================================================================== */
(() => {
    'use strict';

    /* -----------------------------------------------------------------
       CONFIGURACIÓN (único lugar que hay que editar)
       ----------------------------------------------------------------- */
    const CONFIG = {
        // TODO: reemplazar por el WhatsApp real: código de país 52 + 10 dígitos, sin signos
        whatsapp: '523300000000',
        messages: {
            hablar: 'Hola, quiero hablar con un consultor de SIC sobre mi operación.',
            diagnostico: 'Hola, quiero mi diagnóstico gratis de procesos y software.',
            ordenar: 'Hola, estoy listo para ordenar mi operación. ¿Platicamos?',
            software: 'Hola, quiero cotizar un software a la medida para mi empresa.',
            inmobiliario: 'Hola, quiero contarles mi caso del sector inmobiliario.',
            wishpms: 'Hola, quiero ver una demostración de WishPMS para mi hotel.',
            faq: 'Hola, tengo una duda sobre los servicios de SIC.',
            flotante: 'Hola, me gustaría recibir información sobre los servicios de SIC.'
        }
    };

    /* -----------------------------------------------------------------
       UTILIDADES
       ----------------------------------------------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const root = document.documentElement;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const rand = (a, b) => a + Math.random() * (b - a);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

    let lenis = null;

    const waUrl = (key) =>
        `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.messages[key] || CONFIG.messages.flotante)}`;

    const hexToRgb = (hex) => {
        const h = hex.replace('#', '').trim();
        const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
        const n = parseInt(full, 16);
        return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
    };

    // Puntero compartido por los dos canvas del hero
    const pointer = { x: -9999, y: -9999, nx: 0.5, ny: 0.5, active: false };
    if (finePointer) {
        window.addEventListener('pointermove', (e) => {
            pointer.x = e.clientX; pointer.y = e.clientY;
            pointer.nx = e.clientX / window.innerWidth;
            pointer.ny = e.clientY / window.innerHeight;
            pointer.active = true;
        }, { passive: true });
        document.addEventListener('pointerleave', () => { pointer.active = false; });
    }

    /* =================================================================
       1. TEMA CLARO / OSCURO
       ================================================================= */
    function initTheme() {
        const btn = $('#theme-toggle');
        if (!btn) return;
        const icon = btn.querySelector('i');
        const meta = $('meta[name="theme-color"]');

        const apply = (theme, persist) => {
            root.setAttribute('data-theme', theme);
            btn.setAttribute('aria-pressed', String(theme === 'light'));
            btn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
            icon.className = theme === 'light' ? 'ph ph-moon' : 'ph ph-sun';
            if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f8f7' : '#061211');
            if (persist) { try { localStorage.setItem('sic-theme', theme); } catch (e) { /* modo privado */ } }
            window.dispatchEvent(new Event('themechange'));
        };

        apply(root.getAttribute('data-theme') || 'dark', false);
        btn.addEventListener('click', () => apply(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));
    }

    /* =================================================================
       2. ENLACES DE WHATSAPP (todos salen de CONFIG)
       ================================================================= */
    function initWhatsAppLinks() {
        $$('[data-wa]').forEach((a) => {
            a.href = waUrl(a.dataset.wa);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        });
    }

    /* =================================================================
       3. MENÚ MÓVIL + ANCLAS
       ================================================================= */
    let setMenu = () => {};

    function initMenu() {
        const menu = $('#mobile-menu');
        const btn = $('#menu-btn');
        if (!menu || !btn) return;
        let open = false;
        menu.inert = true;

        setMenu = (value) => {
            if (open === value) return;
            open = value;
            menu.classList.toggle('is-open', value);
            menu.setAttribute('aria-hidden', String(!value));
            menu.inert = !value;
            btn.setAttribute('aria-expanded', String(value));
            btn.setAttribute('aria-label', value ? 'Cerrar menú' : 'Abrir menú');
            btn.firstElementChild.className = value ? 'ph ph-x' : 'ph ph-list';
            if (lenis) { value ? lenis.stop() : lenis.start(); }
            else { document.body.style.overflow = value ? 'hidden' : ''; }
            if (value && hasGSAP && !reduceMotion) {
                gsap.fromTo('.mobile-link, .mobile-cta', { y: 36, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.8, stagger: 0.07, delay: 0.25, ease: 'expo.out', clearProps: 'transform' });
            }
        };

        btn.addEventListener('click', () => setMenu(!open));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setMenu(false); btn.focus(); } });
        $('.mobile-cta', menu).addEventListener('click', () => setMenu(false));
    }

    function initAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const href = a.getAttribute('href');
            if (!href || href === '#') return;
            const target = href === '#top' ? document.body : $(href);
            if (!target) return;
            e.preventDefault();
            setMenu(false);
            if (lenis) {
                lenis.scrollTo(href === '#top' ? 0 : target, { offset: -72, duration: 1.7 });
            } else {
                target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            }
        });
    }

    /* =================================================================
       4. FAQ (acordeón accesible)
       ================================================================= */
    function initFAQ() {
        const items = $$('.faq-item');
        items.forEach((item) => {
            const btn = $('.faq-q', item);
            btn.addEventListener('click', () => {
                const wasOpen = item.classList.contains('is-open');
                items.forEach((other) => {
                    other.classList.remove('is-open');
                    $('.faq-q', other).setAttribute('aria-expanded', 'false');
                });
                if (!wasOpen) {
                    item.classList.add('is-open');
                    btn.setAttribute('aria-expanded', 'true');
                }
                if (hasGSAP) setTimeout(() => ScrollTrigger.refresh(), 700);
            });
        });
    }

    /* =================================================================
       5. WISHPMS: pestañas con autoavance
       El avance lo marca la animación CSS de la barra (animationend), así
       pausar con hover/foco/fuera de pantalla es exacto sin temporizadores.
       ================================================================= */
    function initWishTabs() {
        const section = $('#wishpms');
        const wrap = $('#wish');
        if (!section || !wrap) return;
        const tabs = $$('.wish-tab', wrap);
        const panels = $$('.wish-panel', wrap);
        const imgs = $$('.wish-img', wrap);
        let idx = 0;
        let manual = reduceMotion;
        let inView = false;
        let hovering = false;

        if (manual) section.classList.add('is-manual');

        const updatePause = () => section.classList.toggle('is-paused', !inView || hovering);

        const select = (i, { focus = false, user = false } = {}) => {
            idx = (i + tabs.length) % tabs.length;
            tabs.forEach((t, k) => {
                const on = k === idx;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
            });
            panels.forEach((p, k) => { p.hidden = k !== idx; p.classList.toggle('is-active', k === idx); });
            imgs.forEach((im, k) => im.classList.toggle('is-active', k === idx));
            if (user) { manual = true; section.classList.add('is-manual'); }
            if (focus) tabs[idx].focus();
            // En móvil la lista es horizontal: mantener visible la pestaña activa
            tabs[idx].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
            // Reinicia la barra de progreso de la pestaña activa
            const fill = tabs[idx].querySelector('.wish-fill');
            fill.style.animation = 'none';
            void fill.offsetWidth;
            fill.style.animation = '';
        };

        tabs.forEach((t, k) => {
            t.addEventListener('click', () => select(k, { user: true }));
            t.addEventListener('keydown', (e) => {
                const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
                if (keys[e.key]) { e.preventDefault(); select(idx + keys[e.key], { focus: true, user: true }); }
                if (e.key === 'Home') { e.preventDefault(); select(0, { focus: true, user: true }); }
                if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, { focus: true, user: true }); }
            });
        });

        wrap.addEventListener('animationend', (e) => {
            if (e.animationName === 'wishFill' && !manual) select(idx + 1);
        });
        wrap.addEventListener('pointerenter', () => { hovering = true; updatePause(); });
        wrap.addEventListener('pointerleave', () => { hovering = false; updatePause(); });
        wrap.addEventListener('focusin', () => { hovering = true; updatePause(); });
        wrap.addEventListener('focusout', () => { hovering = false; updatePause(); });

        new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; updatePause(); }, { threshold: 0.35 }).observe(wrap);
        updatePause();
    }

    /* =================================================================
       6. SECTOR INMOBILIARIO: acordeón de imágenes
       ================================================================= */
    function initPanos() {
        const items = $$('.pano');
        if (!items.length) return;
        const wide = window.matchMedia('(min-width: 900px)');
        const activate = (el) => {
            items.forEach((p) => {
                const on = p === el;
                p.classList.toggle('is-active', on);
                $('.pano-toggle', p).setAttribute('aria-expanded', String(on));
            });
        };
        items.forEach((p) => {
            const btn = $('.pano-toggle', p);
            btn.addEventListener('click', () => activate(p));
            btn.addEventListener('focus', () => activate(p));
            if (finePointer) p.addEventListener('pointerenter', () => { if (wide.matches) activate(p); });
        });
    }

    /* =================================================================
       7. RESPLANDOR QUE SIGUE AL CURSOR EN TARJETAS
       ================================================================= */
    function initSpotlight() {
        if (!finePointer) return;
        $$('.spot').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${e.clientX - r.left}px`);
                el.style.setProperty('--my', `${e.clientY - r.top}px`);
            }, { passive: true });
        });
    }

    /* =================================================================
       8. CICLO DE DESARROLLO (componente vivo en la tarjeta de software)
       ================================================================= */
    function initPipeline() {
        const items = $$('#pipeline li');
        if (!items.length) return;
        let i = 0;
        const paint = (n) => items.forEach((li, k) => {
            li.classList.toggle('is-done', k < n);
            li.classList.toggle('is-on', k === n);
        });
        paint(0);
        if (reduceMotion) { items.forEach((li) => li.classList.add('is-done')); return; }

        let timer = null;
        const tick = () => { i = (i + 1) % items.length; paint(i); };
        new IntersectionObserver(([entry]) => {
            clearInterval(timer);
            if (entry.isIntersecting) timer = setInterval(tick, 1500);
        }, { threshold: 0.3 }).observe($('#pipeline'));
    }

    /* =================================================================
       9. FORMULARIO -> WHATSAPP (validación en línea)
       ================================================================= */
    function initForm() {
        const form = $('#contact-form');
        if (!form) return;
        const status = $('#form-status');
        const fields = {
            name: { el: $('#f-name'), err: $('#e-name'), msg: 'Escribe tu nombre para saber cómo dirigirnos a ti.', ok: (v) => v.trim().length >= 2 },
            interest: { el: $('#f-interest'), err: $('#e-interest'), msg: 'Elige qué te interesa para preparar la llamada.', ok: (v) => v !== '' }
        };

        const check = (f) => {
            const valid = f.ok(f.el.value);
            f.el.setAttribute('aria-invalid', String(!valid));
            f.err.textContent = valid ? '' : f.msg;
            return valid;
        };
        Object.values(fields).forEach((f) => {
            f.el.addEventListener('input', () => { if (f.el.getAttribute('aria-invalid') === 'true') check(f); });
            f.el.addEventListener('change', () => { if (f.el.getAttribute('aria-invalid') === 'true') check(f); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            status.className = 'form-status';
            status.textContent = '';

            let firstInvalid = null;
            Object.values(fields).forEach((f) => { if (!check(f) && !firstInvalid) firstInvalid = f.el; });
            if (firstInvalid) { firstInvalid.focus(); return; }

            const name = fields.name.el.value.trim();
            const company = $('#f-company').value.trim();
            const interest = fields.interest.el.value;
            const time = $('#f-time').value;
            const message = $('#f-msg').value.trim();

            let text = `Hola, soy *${name}*${company ? ` de *${company}*` : ''}.\n\n`;
            text += `Me interesa: *${interest}*.\n`;
            text += `Horario preferido para la llamada: ${time}.`;
            if (message) text += `\n\nMi reto: ${message}`;
            text += '\n\nQuedo atento(a). ¡Gracias!';

            const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
            status.classList.add('is-ok');
            status.textContent = 'Listo, abriendo WhatsApp. Si no se abre, ';
            const link = document.createElement('a');
            link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = 'haz clic aquí';
            status.append(link, '.');
            window.open(url, '_blank', 'noopener');
        });
    }

    /* =================================================================
       10. CANVAS: ESFERA DE RED 3D (hero)
       Nodos en una esfera de Fibonacci conectados a sus vecinos más
       cercanos. Paquetes de datos viajan por las aristas, siete nodos
       etiquetados representan los módulos del ecosistema. Todo es
       proyección en perspectiva sobre canvas 2D.
       ================================================================= */
    class NetSphere {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.mobile = window.innerWidth < 768;
            this.cam = 4;
            this.rotY = 0.6;
            this.rx = 0.36;
            this.velOffset = 0; this.tiltOffset = 0;
            this.time = 0; this.last = 0;
            this.running = false; this.inView = true;
            this.loop = this.loop.bind(this);

            this.build();
            this.readColors();
            this.resize();

            new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
            window.addEventListener('themechange', () => { this.readColors(); if (!this.running) this.draw(); });
            new IntersectionObserver(([e]) => { this.inView = e.isIntersecting; this.sync(); }, { threshold: 0.05 }).observe(canvas);
            document.addEventListener('visibilitychange', () => this.sync());

            if (reduceMotion) this.draw(); else this.sync();
        }

        build() {
            const N = this.mobile ? 72 : 112;
            const ga = Math.PI * (3 - Math.sqrt(5));
            this.pts = [];
            for (let i = 0; i < N; i++) {
                const y = 1 - (i / (N - 1)) * 2;
                const r = Math.sqrt(1 - y * y);
                const th = i * ga;
                this.pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, sx: 0, sy: 0, sz: 0, k: 1 });
            }

            // Aristas: cada nodo se une a sus 3 vecinos más cercanos
            this.edges = [];
            this.adj = Array.from({ length: N }, () => []);
            const seen = new Set();
            this.pts.forEach((a, i) => {
                const near = this.pts
                    .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
                    .filter((o) => o.j !== i)
                    .sort((p, q) => p.d - q.d)
                    .slice(0, 3);
                near.forEach(({ j }) => {
                    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    this.edges.push([i, j]);
                    this.adj[i].push(j);
                    this.adj[j].push(i);
                });
            });

            // Módulos etiquetados
            const names = ['ERP', 'CRM', 'WishPMS', 'BI', 'APIs', 'Documentos', 'Cobranza'];
            const spots = [0.06, 0.2, 0.36, 0.5, 0.66, 0.82, 0.94];
            this.labeled = names.map((name, i) => ({ name, idx: Math.floor(N * spots[i]) }));

            // Paquetes de datos que saltan de nodo en nodo
            const count = this.mobile ? 8 : 15;
            this.packets = Array.from({ length: count }, () => {
                const a = Math.floor(Math.random() * N);
                const nb = this.adj[a];
                return { prev: -1, a, b: nb[Math.floor(Math.random() * nb.length)], t: Math.random(), speed: rand(0.35, 0.9) };
            });

            // Anillos orbitales con satélite
            this.rings = [
                { rad: 1.3, tilt: 0.42, spin: 0.35, sat: 0.55, off: 0 },
                { rad: 1.5, tilt: -0.9, spin: -0.22, sat: -0.38, off: 2 }
            ];
        }

        readColors() {
            const cs = getComputedStyle(root);
            this.rgb = cs.getPropertyValue('--net-rgb').trim() || '70, 225, 215';
            this.bg = hexToRgb(cs.getPropertyValue('--bg').trim() || '#061211');
        }

        resize() {
            const rect = this.canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.w = rect.width; this.h = rect.height;
            this.canvas.width = Math.round(this.w * this.dpr);
            this.canvas.height = Math.round(this.h * this.dpr);
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.cx = this.w / 2; this.cy = this.h / 2;
            this.R = Math.min(this.w, this.h) * 0.29;
            if (!this.running) this.draw();
        }

        sync() {
            const shouldRun = this.inView && !document.hidden && !reduceMotion;
            if (shouldRun && !this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); }
            else if (!shouldRun) this.running = false;
        }

        loop(now) {
            if (!this.running) return;
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.update(dt);
            this.draw();
            requestAnimationFrame(this.loop);
        }

        update(dt) {
            this.time += dt;
            const wantVel = pointer.active ? (pointer.nx - 0.5) * 0.9 : 0;
            const wantTilt = pointer.active ? (pointer.ny - 0.5) * 0.35 : 0;
            const ease = Math.min(1, dt * 2.5);
            this.velOffset += (wantVel - this.velOffset) * ease;
            this.tiltOffset += (wantTilt - this.tiltOffset) * ease;
            this.rotY += (0.14 + this.velOffset) * dt;
            this.rx = 0.36 + this.tiltOffset;

            this.packets.forEach((p) => {
                p.t += p.speed * dt;
                if (p.t >= 1) {
                    p.prev = p.a; p.a = p.b;
                    const options = this.adj[p.a].filter((n) => n !== p.prev);
                    const pool = options.length ? options : this.adj[p.a];
                    p.b = pool[Math.floor(Math.random() * pool.length)];
                    p.t = 0; p.speed = rand(0.35, 0.9);
                }
            });
        }

        proj(x, y, z, ry, rx, out) {
            const cy = Math.cos(ry), sy = Math.sin(ry);
            const x1 = x * cy + z * sy;
            const z1 = -x * sy + z * cy;
            const cx = Math.cos(rx), sx = Math.sin(rx);
            const y2 = y * cx - z1 * sx;
            const z2 = y * sx + z1 * cx;
            const k = this.cam / (this.cam - z2);
            out.x = this.cx + x1 * this.R * k;
            out.y = this.cy + y2 * this.R * k;
            out.z = z2; out.k = k;
            return out;
        }

        drawRing(ring, side, tmpA, tmpB) {
            const ctx = this.ctx, rgb = this.rgb;
            const steps = 72;
            const ry = this.rotY * ring.spin * 2 + ring.off;
            const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
            const at = (phi, out) => {
                const bx = ring.rad * Math.cos(phi), bz = ring.rad * Math.sin(phi);
                return this.proj(bx * ct, bx * st, bz, ry, this.rx, out);
            };
            ctx.lineWidth = 1;
            for (let i = 0; i < steps; i++) {
                const a = at((i / steps) * TAU, tmpA);
                const ax = a.x, ay = a.y, az = a.z;
                const b = at(((i + 1) / steps) * TAU, tmpB);
                const z = (az + b.z) / 2;
                if ((side > 0) !== (z >= 0)) continue;
                const dn = clamp((z + 1.5) / 3, 0, 1);
                ctx.strokeStyle = `rgba(${rgb},${0.05 + dn * 0.22})`;
                ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            if (side > 0) return;
        }

        drawSatellite(ring, tmpA) {
            const ctx = this.ctx, rgb = this.rgb;
            const ry = this.rotY * ring.spin * 2 + ring.off;
            const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
            const phi0 = this.time * ring.sat;
            const dir = Math.sign(ring.sat) || 1;
            for (let s = 14; s >= 0; s--) {
                const phi = phi0 - dir * s * 0.045;
                const bx = ring.rad * Math.cos(phi), bz = ring.rad * Math.sin(phi);
                const p = this.proj(bx * ct, bx * st, bz, ry, this.rx, tmpA);
                const dn = clamp((p.z + 1.5) / 3, 0.15, 1);
                const f = 1 - s / 15;
                ctx.beginPath();
                ctx.arc(p.x, p.y, (s === 0 ? 3.4 : 2.2 * f) * p.k, 0, TAU);
                ctx.fillStyle = `rgba(${rgb},${(s === 0 ? 1 : 0.5 * f) * dn})`;
                ctx.fill();
            }
        }

        draw() {
            if (!this.w) return;
            const { ctx, w, h, R, cx, cy, rgb } = this;
            ctx.clearRect(0, 0, w, h);

            // Resplandor central
            const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.6);
            g.addColorStop(0, `rgba(${rgb},0.22)`);
            g.addColorStop(0.55, `rgba(${rgb},0.07)`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

            // Ondas tipo sonar
            for (let i = 0; i < 2; i++) {
                const p = (this.time * 0.22 + i * 0.5) % 1;
                ctx.beginPath(); ctx.arc(cx, cy, R * (1 + p * 0.6), 0, TAU);
                ctx.strokeStyle = `rgba(${rgb},${(1 - p) * 0.2})`; ctx.lineWidth = 1; ctx.stroke();
            }

            // Proyección de nodos
            const ry = this.rotY, rx = this.rx;
            this.pts.forEach((p) => {
                const o = this.proj(p.x, p.y, p.z, ry, rx, { x: 0, y: 0, z: 0, k: 1 });
                p.sx = o.x; p.sy = o.y; p.sz = o.z; p.k = o.k;
            });

            const tmpA = { x: 0, y: 0, z: 0, k: 1 }, tmpB = { x: 0, y: 0, z: 0, k: 1 };
            this.rings.forEach((r) => this.drawRing(r, -1, tmpA, tmpB));

            // Aristas
            ctx.lineWidth = 1;
            this.edges.forEach(([i, j]) => {
                const a = this.pts[i], b = this.pts[j];
                const dn = ((a.sz + b.sz) / 2 + 1) / 2;
                ctx.strokeStyle = `rgba(${rgb},${0.05 + dn * 0.3})`;
                ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
            });

            // Paquetes de datos
            this.packets.forEach((p) => {
                const a = this.pts[p.a], b = this.pts[p.b];
                const t = p.t, t0 = Math.max(0, t - 0.22);
                const x = a.sx + (b.sx - a.sx) * t, y = a.sy + (b.sy - a.sy) * t;
                const x0 = a.sx + (b.sx - a.sx) * t0, y0 = a.sy + (b.sy - a.sy) * t0;
                const dn = clamp(((a.sz + b.sz) / 2 + 1) / 2, 0.2, 1);
                ctx.strokeStyle = `rgba(${rgb},${0.7 * dn})`; ctx.lineWidth = 1.8;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
                ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fillStyle = `rgba(${rgb},${0.18 * dn})`; ctx.fill();
                ctx.beginPath(); ctx.arc(x, y, 2.1, 0, TAU); ctx.fillStyle = `rgba(${rgb},${dn})`; ctx.fill();
            });

            // Nodos (primero los traseros)
            const sizeBoost = w < 420 ? 0.8 : 1;
            for (let pass = 0; pass < 2; pass++) {
                this.pts.forEach((p) => {
                    if ((pass === 0) !== (p.sz < 0)) return;
                    const dn = (p.sz + 1) / 2;
                    ctx.beginPath();
                    ctx.arc(p.sx, p.sy, (0.9 + dn * 1.6) * p.k * sizeBoost, 0, TAU);
                    ctx.fillStyle = `rgba(${rgb},${0.22 + dn * 0.7})`;
                    ctx.fill();
                });
            }

            // Anillos delanteros y satélites
            this.rings.forEach((r) => { this.drawRing(r, 1, tmpA, tmpB); this.drawSatellite(r, tmpA); });

            // Módulos etiquetados
            ctx.font = `500 ${this.mobile ? 10.5 : 12.5}px "Geist Mono", ui-monospace, monospace`;
            ctx.textBaseline = 'middle';
            this.labeled.forEach((l, i) => {
                const p = this.pts[l.idx];
                if (p.sz < -0.3) return;
                const a = clamp((p.sz + 0.3) / 1.1, 0, 1);
                ctx.beginPath(); ctx.arc(p.sx, p.sy, 6 * p.k * sizeBoost, 0, TAU);
                ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`; ctx.lineWidth = 1.4; ctx.stroke();
                ctx.beginPath(); ctx.arc(p.sx, p.sy, 2.8 * p.k * sizeBoost, 0, TAU);
                ctx.fillStyle = `rgba(${rgb},${a})`; ctx.fill();

                const pulse = (this.time * 0.6 + i * 0.37) % 1;
                ctx.beginPath(); ctx.arc(p.sx, p.sy, (6 + pulse * 14) * p.k * sizeBoost, 0, TAU);
                ctx.strokeStyle = `rgba(${rgb},${(1 - pulse) * 0.35 * a})`; ctx.lineWidth = 1; ctx.stroke();

                const right = p.sx >= cx;
                const tx = p.sx + (right ? 15 : -15) * p.k;
                ctx.textAlign = right ? 'left' : 'right';
                ctx.lineWidth = 4; ctx.lineJoin = 'round';
                ctx.strokeStyle = `rgba(${this.bg},${0.85 * a})`;
                ctx.strokeText(l.name, tx, p.sy);
                ctx.fillStyle = `rgba(${rgb},${a})`;
                ctx.fillText(l.name, tx, p.sy);
            });
        }
    }

    /* =================================================================
       11. CANVAS: CAMPO DE PARTÍCULAS DE FONDO (hero)
       ================================================================= */
    class BgField {
        constructor(canvas, host) {
            this.canvas = canvas; this.host = host;
            this.ctx = canvas.getContext('2d');
            this.mobile = window.innerWidth < 768;
            this.parts = [];
            this.running = false; this.inView = true; this.last = 0;
            this.loop = this.loop.bind(this);
            this.readColors();
            this.resize();
            new ResizeObserver(() => this.resize()).observe(host);
            window.addEventListener('themechange', () => { this.readColors(); if (!this.running) this.draw(); });
            new IntersectionObserver(([e]) => { this.inView = e.isIntersecting; this.sync(); }, { threshold: 0 }).observe(host);
            document.addEventListener('visibilitychange', () => this.sync());
            if (reduceMotion) this.draw(); else this.sync();
        }
        readColors() { this.rgb = getComputedStyle(root).getPropertyValue('--net-rgb').trim() || '70, 225, 215'; }
        resize() {
            const r = this.host.getBoundingClientRect();
            if (!r.width) return;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.w = r.width; this.h = r.height;
            this.canvas.width = Math.round(this.w * this.dpr);
            this.canvas.height = Math.round(this.h * this.dpr);
            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            const count = this.mobile ? 34 : clamp(Math.round((this.w * this.h) / 15000), 40, 90);
            this.parts = Array.from({ length: count }, () => ({
                x: Math.random() * this.w, y: Math.random() * this.h,
                vx: rand(-14, 14), vy: rand(-14, 14), r: rand(0.6, 1.9)
            }));
            if (!this.running) this.draw();
        }
        sync() {
            const shouldRun = this.inView && !document.hidden && !reduceMotion;
            if (shouldRun && !this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this.loop); }
            else if (!shouldRun) this.running = false;
        }
        loop(now) {
            if (!this.running) return;
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.parts.forEach((p) => {
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.x < -10) p.x = this.w + 10; else if (p.x > this.w + 10) p.x = -10;
                if (p.y < -10) p.y = this.h + 10; else if (p.y > this.h + 10) p.y = -10;
            });
            this.draw();
            requestAnimationFrame(this.loop);
        }
        draw() {
            if (!this.w) return;
            const { ctx, rgb } = this;
            ctx.clearRect(0, 0, this.w, this.h);
            const rect = this.canvas.getBoundingClientRect();
            const mx = pointer.active ? pointer.x - rect.left : -9999;
            const my = pointer.active ? pointer.y - rect.top : -9999;

            ctx.lineWidth = 0.8;
            for (let i = 0; i < this.parts.length; i++) {
                const a = this.parts[i];
                ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU);
                ctx.fillStyle = `rgba(${rgb},0.4)`; ctx.fill();
                for (let j = i + 1; j < this.parts.length; j++) {
                    const b = this.parts[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 115) {
                        ctx.strokeStyle = `rgba(${rgb},${(1 - d / 115) * 0.15})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                const dm = Math.hypot(a.x - mx, a.y - my);
                if (dm < 170) {
                    ctx.strokeStyle = `rgba(${rgb},${(1 - dm / 170) * 0.45})`;
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke();
                }
            }
        }
    }

    function initCanvases() {
        const bg = $('#bg-canvas'), net = $('#net-canvas'), hero = $('.hero');
        if (bg && hero) new BgField(bg, hero);
        if (net) new NetSphere(net);
    }

    /* =================================================================
       12. ANIMACIONES CON GSAP (solo si cargó y no hay movimiento reducido)
       ================================================================= */

    // Divide el texto en palabras manteniendo el marcado interno (strong, em...)
    function wrapWords(el, mode) {
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        if (mode === 'mask') {
                            const outer = document.createElement('span'); outer.className = 'w';
                            const inner = document.createElement('span'); inner.className = 'wi';
                            inner.textContent = part; outer.appendChild(inner); frag.appendChild(outer);
                        } else {
                            const s = document.createElement('span'); s.className = 'sw';
                            s.textContent = part; frag.appendChild(s);
                        }
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1) walk(child);
            });
        };
        walk(el);
        return $$(mode === 'mask' ? '.wi' : '.sw', el);
    }

    function scramble(el, duration) {
        const finalText = el.textContent;
        const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#';
        const o = { p: 0 };
        el.setAttribute('aria-label', finalText);
        gsap.to(o, {
            p: 1, duration, ease: 'none',
            onUpdate() {
                const n = Math.floor(o.p * finalText.length);
                let out = '';
                for (let i = 0; i < finalText.length; i++) {
                    const c = finalText[i];
                    out += (i < n || c === ' ') ? c : glyphs[Math.floor(Math.random() * glyphs.length)];
                }
                el.textContent = out;
            },
            onComplete() { el.textContent = finalText; }
        });
    }

    // Palabra que rota en el titular del hero (animación constante)
    function startRoll() {
        const words = $$('#roll .roll-word');
        if (words.length < 2) return;
        let i = 0;
        const next = () => {
            const cur = words[i];
            i = (i + 1) % words.length;
            const nxt = words[i];
            gsap.timeline()
                .to(cur, { yPercent: -110, opacity: 0, duration: 0.7, ease: 'expo.inOut' }, 0)
                .fromTo(nxt, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, 0.12);
            gsap.delayedCall(2.6, next);
        };
        gsap.delayedCall(2.4, next);
    }

    function buildHeroIntro() {
        const words = $$('#roll .roll-word');
        words.forEach((w, i) => gsap.set(w, { yPercent: i ? 110 : 0, opacity: i ? 0 : 1 }));
        gsap.set('.hero-visual', { scale: 0.84 });

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
        tl.from('.nav-shell', { y: -90, opacity: 0, duration: 1.1, clearProps: 'transform' }, 0)
            .from('#hero-eyebrow', { opacity: 0, y: 14, duration: 0.9 }, 0.05)
            .add(() => scramble($('#hero-eyebrow'), 1.1), 0.05)
            .from('.hero-title .line-in', { yPercent: 115, duration: 1.4, stagger: 0.12 }, 0.1)
            .from('.hero-sub', { opacity: 0, y: 26, duration: 1.1 }, 0.5)
            .from('.hero-actions > *', { opacity: 0, y: 26, duration: 1.1, stagger: 0.1, clearProps: 'transform' }, 0.62)
            .to('.hero-visual', { opacity: 1, scale: 1, duration: 2.2 }, 0.1)
            .add(startRoll, 0.9);
        return tl;
    }

    function runPreloader(onExit) {
        const pre = $('#preloader');
        const numEl = $('#pre-num'), barEl = $('#pre-bar'), statusEl = $('#pre-status');
        const phrases = ['Mapeando procesos', 'Conectando módulos', 'Sincronizando datos', 'Todo listo'];

        let loaded = document.readyState === 'complete';
        let fontsReady = false;
        let finished = false;
        window.addEventListener('load', () => { loaded = true; });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fontsReady = true; });
        else fontsReady = true;

        const state = { p: 0 };
        const paint = () => {
            numEl.textContent = Math.round(state.p);
            gsap.set(barEl, { scaleX: state.p / 100 });
            const idx = state.p < 30 ? 0 : state.p < 62 ? 1 : state.p < 96 ? 2 : 3;
            if (statusEl.textContent !== phrases[idx]) statusEl.textContent = phrases[idx];
        };

        const exit = () => {
            if (finished) return;
            finished = true;
            gsap.timeline({
                onComplete: () => {
                    pre.style.display = 'none';
                    pre.setAttribute('aria-hidden', 'true');
                    root.classList.remove('is-loading');
                    if (lenis) lenis.start();
                    ScrollTrigger.refresh();
                    if (location.hash && $(location.hash) && lenis) lenis.scrollTo($(location.hash), { offset: -72, immediate: true });
                }
            })
                .to('.pre-core', { opacity: 0, scale: 0.9, duration: 0.55, ease: 'power2.in' })
                .to('.pre-bar', { opacity: 0, duration: 0.3 }, '<')
                .to(pre, { '--pg': 0, duration: 0.6 }, '<')
                .to('.pre-half--top', { yPercent: -101, duration: 1.15, ease: 'expo.inOut' }, '-=0.15')
                .to('.pre-half--bottom', { yPercent: 101, duration: 1.15, ease: 'expo.inOut' }, '<')
                .add(onExit, '-=0.75');
        };

        // Fase 1: avance simulado hasta 88 %
        gsap.to(state, { p: 88, duration: 2, ease: 'power2.out', onUpdate: paint });

        // Fase 2: espera a carga real (máx. 5 s) y completa
        const startedAt = performance.now();
        const poll = setInterval(() => {
            const waited = performance.now() - startedAt;
            if ((loaded && fontsReady && waited > 1900) || waited > 5000) {
                clearInterval(poll);
                gsap.to(state, { p: 100, duration: 0.55, ease: 'power2.inOut', onUpdate: paint, onComplete: () => setTimeout(exit, 150) });
            }
        }, 100);
    }

    function initLenis() {
        if (typeof window.Lenis === 'undefined') return null;
        const instance = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
        instance.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => instance.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        instance.stop();
        return instance;
    }

    /* --- Barra de progreso, estado del header y ocultar al bajar --- */
    function initChrome() {
        const bar = $('#progress-bar');
        const header = $('#site-header');
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                gsap.set(bar, { scaleX: self.progress });
                header.classList.toggle('is-scrolled', self.scroll() > 60);
                const hide = self.direction === 1 && self.scroll() > 700;
                header.classList.toggle('is-hidden', hide && !$('#mobile-menu').classList.contains('is-open'));
            }
        });
    }

    /* --- Revelados genéricos al entrar en pantalla --- */
    function initReveals() {
        // Títulos con máscara por palabra
        $$('[data-split]').forEach((heading) => {
            const words = wrapWords(heading, 'mask');
            gsap.set(words, { yPercent: 115 });
            ScrollTrigger.create({
                trigger: heading, start: 'top 88%', once: true,
                onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.045 })
            });
        });

        // Resto de elementos con data-reveal (por lotes, con cascada)
        const reveal = (batch) => gsap.fromTo(batch,
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.1, clearProps: 'transform', overwrite: 'auto' });
        ScrollTrigger.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: reveal, onEnterBack: reveal });
    }

    /* --- Declaración: las palabras se iluminan con el scroll --- */
    function initStatement() {
        const el = $('[data-words]');
        if (!el) return;
        const words = wrapWords(el, 'plain');
        gsap.to(words, {
            opacity: 1, ease: 'none', stagger: 0.12,
            scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true }
        });
    }

    /* --- Del caos a la fuente única --- */
    function initChaos() {
        const pinEl = $('.chaos-pin');
        const stage = $('#chaos-stage');
        if (!pinEl || !stage) return;
        const chips = $$('.chip', stage);
        const lines = $$('.chaos-lines path', stage);
        // Posición de partida (centro del chip, en % del escenario) para cada chip: desorden controlado dentro del recuadro
        const scatter = [
            { x: 30, y: 15, r: -9 }, { x: 74, y: 9, r: 8 }, { x: 80, y: 36, r: 11 }, { x: 62, y: 60, r: -7 },
            { x: 30, y: 82, r: 10 }, { x: 78, y: 86, r: -12 }, { x: 25, y: 40, r: 7 }, { x: 46, y: 32, r: -6 }
        ];
        const ring = chips.map((chip) => ({ x: parseFloat(chip.style.getPropertyValue('--x')), y: parseFloat(chip.style.getPropertyValue('--y')) }));

        const build = () => {
            const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
            chips.forEach((chip, i) => {
                const s = scatter[i % scatter.length];
                tl.fromTo(chip,
                    { x: () => ((s.x - ring[i].x) / 100) * stage.offsetWidth, y: () => ((s.y - ring[i].y) / 100) * stage.offsetHeight, rotation: s.r },
                    { x: 0, y: 0, rotation: 0, duration: 1 }, i * 0.04);
                tl.fromTo(chip, { '--o': 0 }, { '--o': 1, duration: 0.5, ease: 'none' }, 0.55 + i * 0.03);
            });
            tl.fromTo('.chaos-hub', { scale: 0.55, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' }, 0.5)
                .to(lines, { strokeDashoffset: 0, duration: 0.7, stagger: 0.04, ease: 'power2.out' }, 0.85)
                .to('.s-before', { opacity: 0, duration: 0.2, ease: 'none' }, 0.6)
                .to('.s-after', { opacity: 1, duration: 0.2, ease: 'none' }, 0.75);
            return tl;
        };

        const mm = gsap.matchMedia();
        mm.add('(min-width: 900px)', () => {
            ScrollTrigger.create({
                animation: build(), trigger: pinEl, start: 'top top', end: '+=140%',
                pin: true, scrub: 0.8, invalidateOnRefresh: true
            });
        });
        mm.add('(max-width: 899px)', () => {
            const tl = build();
            ScrollTrigger.create({ trigger: stage, start: 'top 68%', once: true, onEnter: () => tl.timeScale(1.1).play() });
        });
    }

    /* --- Metodología: desplazamiento horizontal fijado (escritorio) --- */
    function initMethod() {
        const section = $('#metodologia');
        const pin = $('#method-pin');
        const track = $('#method-track');
        const bar = $('#method-progress');
        if (!section || !pin || !track) return;

        const mm = gsap.matchMedia();
        mm.add('(min-width: 900px)', () => {
            section.classList.add('is-pinned');
            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
            gsap.to(track, {
                x: () => -distance(), ease: 'none',
                scrollTrigger: {
                    trigger: pin, start: 'top top', end: () => `+=${distance()}`,
                    pin: true, scrub: 1, invalidateOnRefresh: true,
                    onUpdate: (self) => gsap.set(bar, { scaleX: self.progress })
                }
            });
            return () => section.classList.remove('is-pinned');
        });
        mm.add('(max-width: 899px)', () => {
            const items = $$('.method-intro, .method-panel', track);
            gsap.set(items, { opacity: 0, y: 40 });
            ScrollTrigger.batch(items, {
                start: 'top 90%', once: true,
                onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 })
            });
        });
    }

    /* --- Contadores --- */
    function initCounters() {
        $$('.counter').forEach((el) => {
            const target = parseFloat(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            ScrollTrigger.create({
                trigger: el, start: 'top 92%', once: true,
                onEnter: () => {
                    const o = { v: 0 };
                    gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } });
                }
            });
        });
    }

    /* --- Marquee: acelera con la velocidad del scroll --- */
    function initMarquee() {
        const track = $('#marquee-track');
        if (!track || !track.getAnimations) return;
        const anim = track.getAnimations()[0];
        if (!anim) return;
        const p = { r: 1 };
        const apply = () => anim.updatePlaybackRate(p.r);
        let back = null;
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: (self) => {
                const target = Math.min(5, 1 + Math.abs(self.getVelocity()) / 320);
                gsap.to(p, { r: target, duration: 0.3, overwrite: true, onUpdate: apply });
                clearTimeout(back);
                back = setTimeout(() => gsap.to(p, { r: 1, duration: 1.2, overwrite: true, onUpdate: apply }), 120);
            }
        });
    }

    /* --- Parallax del hero y palabra gigante del footer --- */
    function initParallax() {
        gsap.to('.hero-copy', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero-visual', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.from('.footer-word', {
            yPercent: 30, opacity: 0.2, ease: 'none',
            scrollTrigger: { trigger: '.footer-word', start: 'top bottom', end: 'bottom bottom', scrub: true }
        });
    }

    /* --- Botones magnéticos (solo puntero fino) --- */
    function initMagnetic() {
        if (!finePointer) return;
        $$('.btn-magnetic').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
            });
            btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
    }

    function initAnimations() {
        root.classList.add('anim');
        lenis = initLenis();
        ScrollTrigger.config({ ignoreMobileResize: true });

        const heroIntro = buildHeroIntro();
        initReveals();
        initStatement();
        initChaos();
        initMethod();
        initCounters();
        initMarquee();
        initParallax();
        initChrome();
        initMagnetic();

        window.addEventListener('load', () => ScrollTrigger.refresh());
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

        runPreloader(() => heroIntro.play());
    }

    /* Ruta sin animaciones: contenido estático, preloader breve y contadores finales */
    function initStaticFallback() {
        $$('.counter').forEach((el) => { el.textContent = el.dataset.target + (el.dataset.suffix || ''); });
        const pre = $('#preloader');
        const done = () => {
            if (pre) { pre.style.transition = 'opacity .4s ease'; pre.style.opacity = '0'; setTimeout(() => { pre.style.display = 'none'; }, 450); }
            root.classList.remove('is-loading');
        };
        if (document.readyState === 'complete') setTimeout(done, reduceMotion ? 0 : 600);
        else window.addEventListener('load', () => setTimeout(done, reduceMotion ? 0 : 600));

        // Estado del header sin escuchar scroll: un centinela observado
        const header = $('#site-header');
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:60px;left:0;width:1px;height:1px;pointer-events:none';
        document.body.prepend(sentinel);
        new IntersectionObserver(([e]) => header.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
    }

    /* =================================================================
       ARRANQUE
       ================================================================= */
    function boot() {
        window.__sicBooted = true;
        initTheme();
        initWhatsAppLinks();
        initMenu();
        initAnchors();
        initFAQ();
        initWishTabs();
        initPanos();
        initSpotlight();
        initPipeline();
        initForm();
        initCanvases();

        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();

        if (hasGSAP && !reduceMotion) {
            try {
                initAnimations();
            } catch (err) {
                // Si algo falla, nunca dejamos contenido oculto
                console.error('[SIC] Error en animaciones, se muestra la versión estática.', err);
                root.classList.remove('anim');
                const pre = $('#preloader');
                if (pre) pre.style.display = 'none';
                root.classList.remove('is-loading');
                $$('.counter').forEach((el) => { el.textContent = el.dataset.target + (el.dataset.suffix || ''); });
            }
        } else {
            initStaticFallback();
        }
    }

    boot();
})();
