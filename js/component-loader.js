/**
 * component-loader.js
 * ====================
 * Lightweight client-side HTML-include mechanism.
 *
 * Any element that carries a `data-include` attribute will have its innerHTML
 * replaced with the fetched HTML fragment, e.g.:
 *
 *   <div data-include="/components/site-header.html"></div>
 *   <div data-include="/components/site-footer.html"></div>
 *   <div data-include="/components/cookie-consent.html"></div>
 *
 * The loader runs as soon as this script is parsed (it waits for
 * DOMContentLoaded so it works whether the script tag is in <head> or at the
 * bottom of <body>).
 *
 * Any <script> tags inside a fetched fragment are evaluated after insertion so
 * that third-party plugins (e.g. Elementor, cookie-consent) continue to work.
 *
 * Security: only paths that begin with "/components/" and end with ".html" are
 * allowed. Any other path is rejected and an error state is set on the element.
 */

(function () {
  'use strict';

  /** Allowlist pattern: only local component files are permitted. */
  var ALLOWED_PATH = /^\/components\/[a-zA-Z0-9_-]+\.html$/;

  /**
   * Fetch `url` and insert the response HTML into `el`, then execute any
   * inline <script> elements that were part of the fragment.
   *
   * @param {HTMLElement} el
   * @param {string}      url
   * @returns {Promise<void>}
   */
  function loadComponent(el, url) {
    // Reject paths that do not match the allowlist to prevent unexpected
    // content injection from arbitrary URLs.
    if (!ALLOWED_PATH.test(url)) {
      console.warn('[component-loader] Blocked disallowed path: ' + url);
      el.setAttribute('data-include-error', 'blocked');
      return Promise.resolve();
    }

    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        // Insert the HTML
        el.innerHTML = html;
        el.removeAttribute('data-include');

        // Re-execute any <script> elements in the fragment because
        // innerHTML assignment does NOT run scripts automatically.
        var scripts = el.querySelectorAll('script');
        scripts.forEach(function (oldScript) {
          var newScript = document.createElement('script');
          // Copy attributes (type, src, defer, async, …)
          Array.from(oldScript.attributes).forEach(function (attr) {
            newScript.setAttribute(attr.name, attr.value);
          });
          // Copy inline content
          if (oldScript.innerHTML) {
            newScript.appendChild(document.createTextNode(oldScript.innerHTML));
          }
          oldScript.parentNode.replaceChild(newScript, oldScript);
        });
      })
      .catch(function (err) {
        console.warn('[component-loader] Failed to load ' + url, err);
        // Mark the element so that CSS or tests can detect the failure.
        el.setAttribute('data-include-error', String(err));
      });
  }

  /**
   * Find all `[data-include]` placeholders and load them in parallel.
   */
  function initComponents() {
    var placeholders = document.querySelectorAll('[data-include]');
    var promises = [];

    placeholders.forEach(function (el) {
      var url = el.getAttribute('data-include');
      if (url) {
        promises.push(loadComponent(el, url));
      }
    });

    return Promise.all(promises);
  }

  // Run after the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }
})();
