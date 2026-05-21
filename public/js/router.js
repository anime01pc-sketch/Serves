const ROUTER = {
  currentPath: null,
  isInitialLoad: true,

  init() {
    window.addEventListener('popstate', () => this.handleBack());
    
    // Handle initial load - get path from URL or use default
    let path = window.location.pathname;
    
    // Sanitize path - remove any hash, query params
    if (path) {
      path = path.split('#')[0].split('?')[0];
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Normalize path - determine correct route based on auth
    if (!path || path === '/' || path === '') {
      if (COMMON.token && COMMON.user && COMMON.serverUrl) {
        path = '/groups';
      } else {
        path = '/';
      }
    }
    
    this.loadRoute(path, true);
  },

  navigate(path, replace = false) {
    if (path === this.currentPath && !replace) return;
    if (replace) {
      history.replaceState({ _router: true, path }, '', path);
    } else {
      history.pushState({ _router: true, path }, '', path);
    }
    this.loadRoute(path, false);
  },

  loadRoute(path, isInitial = false) {
    if (this.currentPath === path && !isInitial) return;
    this.currentPath = path;

    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

    // Map path to screen ID
    let screenId = 'screen-login';
    if (path === '/groups') screenId = 'screen-groups';
    else if (path === '/dashboard') screenId = 'screen-dashboard';
    else if (path === '/pc-control') screenId = 'screen-pccontrol';
    else if (path === '/settings') screenId = 'screen-settings';
    else if (path === '/') screenId = 'screen-login';

    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
    }

    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('routechange', { detail: { path, isInitial } }));
  },

  handleBack() {
    let path = window.location.pathname;
    
    // Sanitize
    if (path) {
      path = path.split('#')[0].split('?')[0];
    }
    
    if (!path || path === '/' || path === '') {
      if (COMMON.token) {
        path = '/groups';
      } else {
        path = '/';
      }
    }
    
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    this.loadRoute(path, false);
    window.dispatchEvent(new CustomEvent('routeback', { detail: { path } }));
  },

  getTitle(path) {
    const titles = {
      '/': 'GameZone',
      '/groups': 'Groups',
      '/dashboard': 'Dashboard',
      '/pc-control': 'PC Control',
      '/settings': 'Settings'
    };
    return titles[path] || 'GameZone';
  }
};