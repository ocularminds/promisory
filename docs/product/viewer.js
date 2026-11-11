/* Local documentation navigation. No network or third-party services. */
(function(){
  'use strict';
  var panes=Array.from(document.querySelectorAll('[data-pane]'));
  function navigate(){
    var hash=decodeURIComponent(location.hash.slice(1));
    var paneId=(hash.split('--')[0]||'start');
    if(!panes.some(function(p){return p.id===paneId;}))paneId='start';
    panes.forEach(function(p){p.hidden=p.id!==paneId;});
    document.querySelectorAll('[data-nav]').forEach(function(a){var current=a.dataset.nav===paneId;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    requestAnimationFrame(function(){var target=document.getElementById(hash);if(hash.indexOf('--')>=0&&target)target.scrollIntoView({block:'start'});else window.scrollTo(0,0);});
    var heading=document.querySelector('#'+paneId+' h1');
    document.title='Promisory · '+(heading?heading.textContent:'Product package');
  }
  window.addEventListener('hashchange',navigate);
  navigate();
})();
