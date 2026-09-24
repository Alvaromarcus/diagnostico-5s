/* Aviso de Google Analytics com consentimento (LGPD).
   O gtag.js só é carregado depois que o visitante clica em "Aceitar".
   A escolha fica salva no navegador e pode ser alterada pelo link "Privacidade e cookies" no rodapé. */
(function () {
    'use strict';
    var GA_ID = 'G-JBG8TGWGFL';
    var KEY = 'plataforma-lean:analytics';
    var gaLoaded = false;

    function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* navegação privada */ } }

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;
    gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

    function loadGA() {
        gtag('consent', 'update', { analytics_storage: 'granted' });
        if (gaLoaded) return;
        gaLoaded = true;
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
        document.head.appendChild(s);
        gtag('js', new Date());
        gtag('config', GA_ID);
    }

    function removeGACookies() {
        gtag('consent', 'update', { analytics_storage: 'denied' });
        document.cookie.split(';').forEach(function (c) {
            var name = c.split('=')[0].trim();
            if (name.indexOf('_ga') === 0) {
                var host = location.hostname;
                document.cookie = name + '=; Max-Age=0; path=/';
                document.cookie = name + '=; Max-Age=0; path=/; domain=' + host;
                document.cookie = name + '=; Max-Age=0; path=/; domain=.' + host;
            }
        });
    }

    var banner;
    function buildBanner() {
        banner = document.createElement('div');
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', 'Aviso sobre Google Analytics');
        banner.innerHTML =
            '<p>Este site usa o Google Analytics só para contar visitas. Não há anúncios, você não é seguido em outros sites ' +
            'e os dados que você preenche nas ferramentas ficam apenas no seu navegador. Tudo bem?</p>' +
            '<div class="consent-actions">' +
            '<button type="button" class="consent-btn consent-decline">Recusar</button>' +
            '<button type="button" class="consent-btn consent-accept">Aceitar</button>' +
            '</div>';
        banner.querySelector('.consent-accept').addEventListener('click', function () { setChoice('granted'); loadGA(); hide(); });
        banner.querySelector('.consent-decline').addEventListener('click', function () { setChoice('denied'); removeGACookies(); hide(); });
        document.body.appendChild(banner);
    }
    function show() { if (!banner) buildBanner(); banner.hidden = false; banner.querySelector('.consent-accept').focus({ preventScroll: true }); }
    function hide() { if (banner) banner.hidden = true; }

    window.abrirPreferenciasCookies = show;

    function init() {
        var choice = getChoice();
        if (choice === 'granted') loadGA();
        else if (choice !== 'denied') show();
        document.querySelectorAll('[data-consent-open]').forEach(function (el) {
            el.addEventListener('click', function (e) { e.preventDefault(); show(); });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
