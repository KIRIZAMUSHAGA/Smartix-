/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            screens: {
                'xs': '475px',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                // =============================
                // COULEURS POUR L'INDICATEUR HORS-LIGNE
                // =============================
                offline: {
                    offline: '#ef4444',      // rouge
                    reconnecting: '#3b82f6', // bleu
                    limited: '#f97316',      // orange
                    online: '#22c55e'        // vert
                }
            },
            keyframes: {
                // Animations existantes
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' }
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' }
                },
                // =============================
                // NOUVELLES ANIMATIONS POUR LES COMPOSANTS
                // =============================
                
                // Animations de texte
                'fadeIn': {
                    from: { opacity: '0' },
                    to: { opacity: '1' }
                },
                'slideUp': {
                    from: { transform: 'translateY(20px)', opacity: '0' },
                    to: { transform: 'translateY(0)', opacity: '1' }
                },
                'slideDown': {
                    from: { transform: 'translateY(-20px)', opacity: '0' },
                    to: { transform: 'translateY(0)', opacity: '1' }
                },
                'slideLeft': {
                    from: { transform: 'translateX(20px)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' }
                },
                'slideRight': {
                    from: { transform: 'translateX(-20px)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' }
                },
                'bounce': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' }
                },
                'zoomIn': {
                    from: { transform: 'scale(0.8)', opacity: '0' },
                    to: { transform: 'scale(1)', opacity: '1' }
                },
                'zoomOut': {
                    from: { transform: 'scale(1.2)', opacity: '0' },
                    to: { transform: 'scale(1)', opacity: '1' }
                },
                'rotate': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' }
                },
                'pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' }
                },
                'shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-5px)' },
                    '75%': { transform: 'translateX(5px)' }
                },
                'glitch': {
                    '0%': { transform: 'skew(0deg, 0deg)', opacity: '1' },
                    '25%': { transform: 'skew(2deg, 1deg)', opacity: '0.8' },
                    '75%': { transform: 'skew(-2deg, -1deg)', opacity: '0.9' },
                    '100%': { transform: 'skew(0deg, 0deg)', opacity: '1' }
                },
                'neonPulse': {
                    '0%, 100%': { textShadow: '0 0 5px #00FF00, 0 0 10px #00FF00' },
                    '50%': { textShadow: '0 0 20px #00FF00, 0 0 30px #00FF00' }
                },
                // Typewriter spécial
                'typewriter': {
                    from: { width: '0' },
                    to: { width: '100%' }
                },
                // =============================
                // NOUVELLES ANIMATIONS POUR L'INDICATEUR HORS-LIGNE
                // =============================
                'slideDownFast': {
                    from: { transform: 'translateY(-100%)', opacity: '0' },
                    to: { transform: 'translateY(0)', opacity: '1' }
                },
                'slideUpFast': {
                    from: { transform: 'translateY(0)', opacity: '1' },
                    to: { transform: 'translateY(-100%)', opacity: '0' }
                },
                'pulseWarning': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' }
                },
                'spinSlow': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' }
                }
            },
            animation: {
                // Animations existantes
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                
                // =============================
                // NOUVELLES ANIMATIONS POUR LES COMPOSANTS
                // =============================
                
                // Animations de texte (AdvancedTextEditor)
                'fadeIn': 'fadeIn 0.5s ease-out forwards',
                'slideUp': 'slideUp 0.5s ease-out forwards',
                'slideDown': 'slideDown 0.5s ease-out forwards',
                'slideLeft': 'slideLeft 0.5s ease-out forwards',
                'slideRight': 'slideRight 0.5s ease-out forwards',
                'bounce': 'bounce 0.8s ease-out forwards',
                'zoomIn': 'zoomIn 0.5s ease-out forwards',
                'zoomOut': 'zoomOut 0.5s ease-out forwards',
                'rotate': 'rotate 0.6s ease-out forwards',
                'pulse': 'pulse 0.8s ease-out forwards',
                'shake': 'shake 0.4s ease-out forwards',
                'glitch': 'glitch 0.3s ease-out forwards',
                'neonPulse': 'neonPulse 1s ease-out forwards',
                'typewriter': 'typewriter 1.5s steps(40, end) forwards',
                
                // Animations utilitaires
                'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'spin-slow': 'spin 3s linear infinite',
                'fadeIn-fast': 'fadeIn 0.2s ease-out',
                'slideUp-fast': 'slideUp 0.2s ease-out',
                
                // =============================
                // NOUVELLES ANIMATIONS POUR L'INDICATEUR HORS-LIGNE
                // =============================
                'slideDown-fast': 'slideDownFast 0.3s ease-out forwards',
                'slideUp-fast': 'slideUpFast 0.3s ease-out forwards',
                'pulse-warning': 'pulseWarning 1s ease-in-out infinite',
                'spin-slow': 'spinSlow 2s linear infinite'
            },
            // =============================
            // WILL-CHANGE POUR OPTIMISATION GPU
            // =============================
            willChange: {
                'transform': 'transform',
                'opacity': 'opacity',
                'filter': 'filter',
                'scale': 'scale',
                'position': 'position'
            },
            // =============================
            // SAFE AREA INSETS (pour les appareils avec notch)
            // =============================
            padding: {
                'safe-top': 'env(safe-area-inset-top)',
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-left': 'env(safe-area-inset-left)',
                'safe-right': 'env(safe-area-inset-right)'
            },
            margin: {
                'safe-top': 'env(safe-area-inset-top)',
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-left': 'env(safe-area-inset-left)',
                'safe-right': 'env(safe-area-inset-right)'
            },
            // =============================
            // SPACING POUR LES ANIMATIONS DE SLIDE
            // =============================
            translate: {
                'full': '100%',
                'screen': '100vh'
            }
        }
    },
    plugins: [
        require("tailwindcss-animate"),
        // =============================
        // UTILITAIRES PERSONNALISÉS
        // =============================
        function({ addUtilities, addComponents, theme }) {
            addUtilities({
                // Scrollbar
                '.scrollbar-hide': {
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                },
                '.scrollbar-default': {
                    '-ms-overflow-style': 'auto',
                    'scrollbar-width': 'auto',
                    '&::-webkit-scrollbar': {
                        display: 'block',
                    },
                },
                // GPU acceleration
                '.will-change-transform': {
                    'will-change': 'transform',
                },
                '.will-change-opacity': {
                    'will-change': 'opacity',
                },
                '.will-change-filter': {
                    'will-change': 'filter',
                },
                // Safe area helpers
                '.pt-safe-top': {
                    paddingTop: 'env(safe-area-inset-top)',
                },
                '.pb-safe-bottom': {
                    paddingBottom: 'env(safe-area-inset-bottom)',
                },
                '.pl-safe-left': {
                    paddingLeft: 'env(safe-area-inset-left)',
                },
                '.pr-safe-right': {
                    paddingRight: 'env(safe-area-inset-right)',
                },
                // Offline indicator specific
                '.offline-indicator-enter': {
                    animation: 'slideDownFast 0.3s ease-out forwards',
                },
                '.offline-indicator-exit': {
                    animation: 'slideUpFast 0.3s ease-out forwards',
                },
                '.reconnecting-pulse': {
                    animation: 'pulseWarning 1s ease-in-out infinite',
                },
                // Animation utilities
                '.animate-in': {
                    animationFillMode: 'forwards',
                },
                '.animate-out': {
                    animationFillMode: 'forwards',
                }
            });
            
            // =============================
            // COMPOSANTS PERSONNALISÉS
            // =============================
            addComponents({
                '.offline-indicator': {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    paddingTop: 'env(safe-area-inset-top)',
                    transition: 'all 0.3s ease-out',
                    willChange: 'transform, opacity'
                },
                '.offline-indicator-content': {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme('spacing.4'),
                    padding: `${theme('spacing.2.5')} ${theme('spacing.4')}`,
                    fontSize: theme('fontSize.sm')[0],
                    fontWeight: theme('fontWeight.medium'),
                    backdropFilter: 'blur(4px)',
                    boxShadow: theme('boxShadow.lg')
                }
            });
        }
    ],
};
