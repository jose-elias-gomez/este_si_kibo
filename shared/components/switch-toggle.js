class SwitchToggle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.shadowRoot.querySelector('input').addEventListener('change', (e) => {
      this.dispatchEvent(new CustomEvent('change', {
        detail: { checked: e.target.checked },
        bubbles: true,
        composed: true
      }));
    });
  }

  static get observedAttributes() {
    return ['checked', 'disabled'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    const input = this.shadowRoot.querySelector('input');
    if (!input) return;

    if (name === 'checked') {
      input.checked = this.hasAttribute('checked');
    } else if (name === 'disabled') {
      input.disabled = this.hasAttribute('disabled');
    }
  }

  get checked() {
    return this.hasAttribute('checked');
  }

  set checked(val) {
    if (val) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
  }

  render() {
    const isChecked = this.hasAttribute('checked') ? 'checked' : '';
    const isDisabled = this.hasAttribute('disabled') ? 'disabled' : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          vertical-align: middle;
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 64px;
          height: 28px;
          flex-shrink: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          inset: 0;
          background: transparent;
          border-radius: var(--radius-pill, 999px);
          border: 1px solid var(--color-border, #3e4a6b);
          cursor: pointer;
          transition: background var(--duration-base, 0.35s) var(--ease-panel, cubic-bezier(0.22, 0.8, 0.25, 1));
        }

        .slider::before {
          content: "";
          position: absolute;
          height: 16px;
          width: 16px;
          left: 8px;
          top: 6px;
          background: var(--color-text, #eeeeee);
          border-radius: 50%;
          transition: transform var(--duration-base, 0.35s) var(--ease-panel, cubic-bezier(0.22, 0.8, 0.25, 1));
        }

        input:checked + .slider {
          border: 0px;
          background: var(--accent-triangle, #3ee6a8);
        }

        input:checked + .slider::before {
          transform: translateX(34px);
          background: var(--color-bg, #0b0c12);
        }

        input:disabled + .slider {
          opacity: 0.5;
          cursor: not-allowed;
        }
      </style>

      <label class="switch">
        <input type="checkbox" ${isChecked} ${isDisabled}>
        <span class="slider"></span>
      </label>
    `;
  }
}

customElements.define('switch-toggle', SwitchToggle);