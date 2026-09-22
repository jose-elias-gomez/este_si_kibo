export const EXPRESSIONS_TYPE = Object.freeze({
    CONFUSION: {
        id: "confusion",
        duration: 1000,
        repeat: 2
    },

    SAD: {
        id: "sad",
        duration: 2000,
        repeat: 1
    },

    NO: {
        id: "no",
        duration: 1000,
        repeat: 1
    }
})

export function getExpressionSvgUrl(type = EXPRESSIONS_TYPE.CONFUSION) {
    return "../../../shared/assets/expressions/animated/" + type.id.toLocaleLowerCase() + ".svg";
}


export function displayAnimation(type = EXPRESSIONS_TYPE.CONFUSION) {
    const dialog = getDialog();
    dialog.showModal();
    
    const image = document.createElement("img");
    image.src = getExpressionSvgUrl(type);
    image.className = "expression-image";
    dialog.innerHTML = '';

    if (type == EXPRESSIONS_TYPE.CONFUSION) {
        // svgator no te voy a pagar pa, sorry brother uwu nya
        const watermarkRemover = document.createElement("div");
        watermarkRemover.classList.add("water-mark-remover");
        dialog.appendChild(watermarkRemover);
    }

    dialog.appendChild(image);

    setTimeout(() => dialog.close(), type.duration * type.repeat);
}

function getDialog() {
    var expressions = document.getElementById("expression-dialog");
    if (expressions != null) {
        return expressions;
    }

    if (!document.getElementById("expression-dialog-styles")) {
        const style = document.createElement("style");
        style.id = "expression-dialog-styles";
        style.textContent = `
            #expression-dialog {
                z-index: 1000;
                background-color: #000;
                border: none;
                color: #fff;
                position: relative;
                overflow: hidden;
            }

            #expression-dialog::backdrop {
                background-color: #000;
            }

            #expression-dialog[open] {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: center;
                inset: 0;
                margin: 0;
                padding: 0;
                border: none;
                width: 100%;
                height: 100%;
                max-width: none;
                max-height: none;
                box-sizing: border-box;
            }

            #expression-dialog .expression-image {
                display: block;
                flex: 0 0 800px;
                width: 800px;
                height: 480px;
                max-width: none;
                max-height: none;
            }

            .water-mark-remover {
                position: absolute;
                bottom: 0px;
                right: 0px;
                width: 230px;
                height: 100px;
                background-color: #000;
            }
        `;
        document.head.appendChild(style);
    }

    expressions = document.createElement("dialog");
    expressions.id = "expression-dialog";

    document.body.appendChild(expressions);

    return expressions;
}
