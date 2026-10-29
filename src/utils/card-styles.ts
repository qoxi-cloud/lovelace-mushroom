import { css } from "lit";

export const cardStyle = css`
  ha-card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: var(--layout-align);
    height: auto;
    display: flex;
    flex-direction: column;
  }
  ha-card.fill-container {
    height: 100%;
  }
  :host([layout="grid"]) ha-card {
    height: 100%;
  }
  .actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE 10+ */
    padding: var(--control-spacing);
    padding-top: 0;
    box-sizing: border-box;
    gap: var(--control-spacing);
  }
  .actions::-webkit-scrollbar {
    background: transparent; /* Chrome/Safari/Webkit */
    height: 0px;
  }
  .unavailable {
    --main-color: rgb(var(--rgb-warning));
  }
  .not-found {
    --main-color: rgb(var(--rgb-danger));
  }
  mushroom-state-item[disabled] {
    cursor: initial;
  }

  ha-card.qoxi-active {
    background: var(--qoxi-active-card-background, var(--ha-card-background));
    --primary-text-color: var(
      --qoxi-active-text-color,
      var(--primary-text-color)
    );
    --secondary-text-color: var(
      --qoxi-active-secondary-text-color,
      var(--secondary-text-color)
    );
    --qoxi-shape-color: var(--qoxi-active-shape-color, var(--qoxi-shape-color));
  }
`;
