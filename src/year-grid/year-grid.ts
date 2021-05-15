import '../year-grid-button/app-year-grid-button.js';

import { property } from '@lit/reactive-element/decorators/property.js';
import type { TemplateResult } from 'lit';
import { nothing } from 'lit';
import { html, LitElement } from 'lit';
import { toUTCDate } from 'nodemod/dist/calendar/helpers/to-utc-date.js';

import { resetShadowRoot } from '../ stylings.js';
import { MAX_DATE } from '../constants.js';
import { dispatchCustomEvent } from '../helpers/dispatch-custom-event.js';
import { toResolvedDate } from '../helpers/to-resolved-date.js';
import { toYearList } from '../helpers/to-year-list.js';
import { APP_YEAR_GRID_BUTTON_NAME } from '../year-grid-button/constants.js';
import { yearGridStyling } from './stylings.js';
import type { YearGridData, YearGridProperties } from './typings.js';

export class YearGrid extends LitElement implements YearGridProperties {
  @property({ attribute: false })
  public data: YearGridData;

  public static styles = [
    resetShadowRoot,
    yearGridStyling,
  ];

  constructor() {
    super();

    const todayDate = toResolvedDate();

    this.data = {
      date: todayDate,
      formatters: undefined,
      max: MAX_DATE,
      min: todayDate,
    };
  }

  protected shouldUpdate(): boolean {
    return this.data.formatters != null;
  }

  protected render(): TemplateResult | typeof nothing {
    const {
      date,
      formatters,
      max,
      min,
    } = this.data;

    if (formatters == null) return nothing;

    const { yearFormat } = formatters;
    const yearList = toYearList(min, max);

    return html`
    <div class="year-grid" @click=${this.#updateYear} @keyup=${this.#updateYear}>${
      yearList.map((year) => {
        const yearDate = toUTCDate(year, 1, 1);
        const yearLabel = yearFormat(yearDate);
        const isYearSelected = yearDate.getUTCFullYear() === date.getUTCFullYear();

        return html`
        <app-year-grid-button
          data-year=${year}
          label=${yearLabel}
          ?unelevated=${isYearSelected}
        ></app-year-grid-button>
        `;
      })
    }</div>
    `;
  }

  #updateYear = (ev: MouseEvent): void => {
    const selectedYearGridButton = Array.from(
      ev.composedPath() as HTMLElement[]
    ).find(
      element =>
        element.localName === APP_YEAR_GRID_BUTTON_NAME &&
        element.hasAttribute('data-year')
    );
    const year = Number(
      selectedYearGridButton?.getAttribute('data-year') ??
      this.data.date.getUTCFullYear()
    );

    dispatchCustomEvent(this, 'year-updated', { year });
  };
}
