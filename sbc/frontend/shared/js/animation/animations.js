export const ANIMATIONS = Object.freeze({
    /* Otros casos de usos: Desagrado e Incapacidad */
    no: [
        { move: { Head: -88 } },
        { wait: 100 },
        { move: { Head: 88 } },
        { wait: 100 },
        { move: { Head: 0 } }
    ],

    /* Otros casos de uso: En espera, Escuchando, Curiosidad, Modo pensativo, Movimiento aleatorio*/
    confusion: [
        { move: { Head: -30} },
        { wait: 300 },
        { move: { RightArm: -20 }},
        { wait: 100 },
        { move: { RightArm: 20 }},
        { wait: 1000 },
        { move: { RightArm: 0 } },
        { wait: 300 },
        { move: { Head: 0 } }
    ],

    /* Otros casos: Molestia por toque, Berrinche, Frustración */
    angry: [
        { move: { Head: -88, LeftArm: -88 } },
        { wait: 100 },
        { move: { Head: 88 } },
        { wait: 100 },
        { move: { Head: 0, LeftArm: 0 } }
    ],

    /* Otros casos de usos: Asentimiento, Afirmativo, Saludo, Bienvenida, Logro y Victoria */
    happy: [
        { move: { Head: 20 }},
        { move: { LeftArm: -88, RightArm: -88 }, yoyo: true, repeat: 2},
        { move: { Head: -20 }},
        { wait: 200 },
        { move: { LeftArm: 0, RightArm: 0, Head: 0 } }
    ],

    /* Otros casos de uso: Despedida, Apagado, Soledad, Aburrimiento y Culpa */
    sad: [
        { move: { Head: -5, LeftArm: 20, RightArm: 20 } },
        { wait: 500 },
        { move: { Head: 5, LeftArm: -20, RightArm: -20 } },
        { wait: 500 },
        { move: { LeftArm: 0, RightArm: 0, Head: 0 } }
    ],

    /* Otros casos de uso: Entusiasmo, Prisa, Ejercicio, Baile, Susto y Huida */
    run: [
        { move: { LeftArm: -45, RightArm: 45, Head: -20 }},
        { wait: 100 },
        { move: { LeftArm: 45, RightArm: -45, Head: 20 }},
        { wait: 100 },
        { move: { LeftArm: -45, RightArm: 45, Head: -20 }},
        { wait: 100 },
        { move: { LeftArm: 45, RightArm: -45, Head: 20 }},
        { wait: 100 },
        { move: { LeftArm: 0, RightArm: 0, Head: 0 } }
    ],

    surprise: [
        { move: { LeftArm: -88, RightArm: -88 }},
        { wait: 1000 },
        { move: { LeftArm: 0, RightArm: 0 }}
    ],

    dance: [
        { move: { Head: -45, LeftArm: 0, RightArm: -88 } },
        { wait: 250 },
        
        { move: { Head: 45, LeftArm: -88, RightArm: 0 } },
        { wait: 250 },

        { move: { Head: 0, LeftArm: -45, RightArm: -45 } },
        { wait: 300 },

        { move: { Head: -20, LeftArm: -88, RightArm: 45 } },
        { wait: 120 },
        { move: { Head: 20, LeftArm: 45, RightArm: -88 } },
        { wait: 120 },

        { move: { Head: 0, LeftArm: -88, RightArm: -88 } },
        { wait: 400 },

        { move: { Head: 0, LeftArm: 0, RightArm: 0 } }
    ]
});