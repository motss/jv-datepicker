interface ParamUpdatedChanged extends Omit<Datepicker, keyof LitElement> {
  _selectedDate: Date;
  _focusedDate: Date;
  _startView: StartView;
}

import {
  css,
  eventOptions,
  html,
  LitElement,
  property,
  query,
  TemplateResult
} from 'lit-element';
import { cache } from 'lit-html/directives/cache.js';
import { classMap } from 'lit-html/directives/class-map.js';
import { repeat } from 'lit-html/directives/repeat.js';
import type { WeekNumberType } from 'nodemod/dist/calendar/calendar_typing.js';
import { toUTCDate } from 'nodemod/dist/calendar/helpers/to-utc-date.js';
import { iconChevronLeft, iconChevronRight } from './app-datepicker-icons.js';
import { datepickerVariables, resetButton } from './common-styles.js';
import { ALL_NAV_KEYS_SET } from './constants.js';
import type {
  DatepickerFirstUpdated,
  DatepickerValueUpdated,
  Formatters,
  HTMLElementPart,
  MonthUpdateType,
  StartView
} from './custom_typings.js';
import { KEY_CODES_MAP } from './custom_typings.js';
import { animateElement } from './helpers/animate-element.js';
import { computeNextFocusedDate } from './helpers/compute-next-focus-date.js';
import { dispatchCustomEvent } from './helpers/dispatch-custom-event.js';
import { findShadowTarget } from './helpers/find-shadow-target.js';
import { getDateRange } from './helpers/get-date-range.js';
import { getFormatters } from './helpers/get-formatters.js';
import { getMultiCalendars } from './helpers/get-multi-calendars.js';
import { getResolvedDate } from './helpers/get-resolved-date.js';
import { getResolvedLocale } from './helpers/get-resolved-locale.js';
import { hasClass } from './helpers/has-class.js';
import { isValidDate } from './helpers/is-valid-date.js';
import { makeNumberPrecise } from './helpers/make-number-precise.js';
import { passiveHandler } from './helpers/passive-handler.js';
import { splitString } from './helpers/split-string.js';
import { targetScrollTo } from './helpers/target-scroll-to.js';
import { toFormattedDateString } from './helpers/to-formatted-date-string.js';
import { toYearList } from './helpers/to-year-list.js';
import { updateYearWithMinMax } from './helpers/update-year-with-min-max.js';
import type { TrackerHandlers } from './tracker.js';
import { Tracker } from './tracker.js';

export class Datepicker extends LitElement {
  public static styles = [
    // tslint:disable:max-line-length
    datepickerVariables,
    resetButton,
    css`
    :host {
      width: 312px;
      /** NOTE: Magic number as 16:9 aspect ratio does not look good */
      /* height: calc((var(--app-datepicker-width) / .66) - var(--app-datepicker-footer-height, 56px)); */
      background-color: var(--app-datepicker-bg-color, #fff);
      color: var(--app-datepicker-color, #000);
      border-radius:
        var(--app-datepicker-border-top-left-radius, 0)
        var(--app-datepicker-border-top-right-radius, 0)
        var(--app-datepicker-border-bottom-right-radius, 0)
        var(--app-datepicker-border-bottom-left-radius, 0);
      contain: content;
      overflow: hidden;
    }
    :host([landscape]) {
      display: flex;

      /** <iphone-5-landscape-width> - <standard-side-margin-width> */
      min-width: calc(568px - 16px * 2);
      width: calc(568px - 16px * 2);
    }

    .datepicker-header + .datepicker-body {
      border-top: 1px solid var(--app-datepicker-separator-color, #ddd);
    }
    :host([landscape]) > .datepicker-header + .datepicker-body {
      border-top: none;
      border-left: 1px solid var(--app-datepicker-separator-color, #ddd);
    }

    .datepicker-header {
      display: flex;
      flex-direction: column;
      align-items: flex-start;

      position: relative;
      padding: 16px 24px;
    }
    :host([landscape]) > .datepicker-header {
      /** :this.<one-liner-month-day-width> + :this.<side-padding-width> */
      min-width: calc(14ch + 24px * 2);
    }

    .btn__year-selector,
    .btn__calendar-selector {
      color: var(--app-datepicker-selector-color, rgba(0, 0, 0, .55));
      cursor: pointer;
      /* outline: none; */
    }
    .btn__year-selector.selected,
    .btn__calendar-selector.selected {
      color: currentColor;
    }

    /**
      * NOTE: IE11-only fix. This prevents formatted focused date from overflowing the container.
      */
    .datepicker-toolbar {
      width: 100%;
    }

    .btn__year-selector {
      font-size: 16px;
      font-weight: 700;
    }
    .btn__calendar-selector {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
    }

    .datepicker-body {
      position: relative;
      width: 100%;
      overflow: hidden;
    }

    .datepicker-body__calendar-view {
      min-height: 56px;
    }

    .calendar-view__month-selector {
      display: flex;
      align-items: center;

      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      padding: 0 8px;
      z-index: 1;
    }

    .month-selector-container {
      max-height: 56px;
      height: 100%;
    }
    .month-selector-container + .month-selector-container {
      margin: 0 0 0 auto;
    }

    .btn__month-selector {
      padding: calc((56px - 24px) / 2);
      /**
        * NOTE: button element contains no text, only SVG.
        * No extra height will incur with such setting.
        */
      line-height: 0;
    }
    .btn__month-selector > svg {
      fill: currentColor;
    }

    .calendars-container {
      display: flex;
      justify-content: center;

      position: relative;
      top: 0;
      left: calc(-100%);
      width: calc(100% * 3);
      transform: translateZ(0);
      will-change: transform;
      /**
        * NOTE: Required for Pointer Events API to work on touch devices.
        * Native \`pan-y\` action will be fired by the browsers since we only care about the
        * horizontal direction. This is great as vertical scrolling still works even when touch
        * event happens on a datepicker's calendar.
        */
      touch-action: pan-y;
      /* outline: none; */
    }

    .year-list-view__full-list {
      max-height: calc(48px * 7);
      overflow-y: auto;

      scrollbar-color: var(--app-datepicker-scrollbar-thumb-bg-color, rgba(0, 0, 0, .35)) rgba(0, 0, 0, 0);
      scrollbar-width: thin;
    }
    .year-list-view__full-list::-webkit-scrollbar {
      width: 8px;
      background-color: rgba(0, 0, 0, 0);
    }
    .year-list-view__full-list::-webkit-scrollbar-thumb {
      background-color: var(--app-datepicker-scrollbar-thumb-bg-color, rgba(0, 0, 0, .35));
      border-radius: 50px;
    }
    .year-list-view__full-list::-webkit-scrollbar-thumb:hover {
      background-color: var(--app-datepicker-scrollbar-thumb-hover-bg-color, rgba(0, 0, 0, .5));
    }

    .calendar-weekdays > th,
    .weekday-label {
      color: var(--app-datepicker-weekday-color, rgba(0, 0, 0, .55));
      font-weight: 400;
      transform: translateZ(0);
      will-change: transform;
    }

    .calendar-container,
    .calendar-label,
    .calendar-table {
      width: 100%;
    }

    .calendar-container {
      position: relative;
      padding: 0 16px 16px;
    }

    .calendar-table {
      -moz-user-select: none;
      -webkit-user-select: none;
      user-select: none;

      border-collapse: collapse;
      border-spacing: 0;
      text-align: center;
    }

    .calendar-label {
      display: flex;
      align-items: center;
      justify-content: center;

      height: 56px;
      font-weight: 500;
      text-align: center;
    }

    .calendar-weekday,
    .full-calendar__day {
      position: relative;
      width: calc(100% / 7);
      height: 0;
      padding: calc(100% / 7 / 2) 0;
      outline: none;
      text-align: center;
    }
    .full-calendar__day:not(.day--disabled):focus {
      outline: #000 dotted 1px;
      outline: -webkit-focus-ring-color auto 1px;
    }
    :host([showweeknumber]) .calendar-weekday,
    :host([showweeknumber]) .full-calendar__day {
      width: calc(100% / 8);
      padding-top: calc(100% / 8);
      padding-bottom: 0;
    }
    :host([showweeknumber]) th.weekday-label {
      padding: 0;
    }

    /**
      * NOTE: Interesting fact! That is ::after will trigger paint when dragging. This will trigger
      * layout and paint on **ONLY** affected nodes. This is much cheaper as compared to rendering
      * all :::after of all calendar day elements. When dragging the entire calendar container,
      * because of all layout and paint trigger on each and every ::after, this becomes a expensive
      * task for the browsers especially on low-end devices. Even though animating opacity is much
      * cheaper, the technique does not work here. Adding 'will-change' will further reduce overall
      * painting at the expense of memory consumption as many cells in a table has been promoted
      * a its own layer.
      */
    .full-calendar__day:not(.day--empty):not(.day--disabled):not(.weekday-label) {
      transform: translateZ(0);
      will-change: transform;
    }
    .full-calendar__day:not(.day--empty):not(.day--disabled):not(.weekday-label).day--focused::after,
    .full-calendar__day:not(.day--empty):not(.day--disabled):not(.day--focused):not(.weekday-label):hover::after {
      content: '';
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--app-datepicker-accent-color, #1a73e8);
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
    }
    .full-calendar__day:not(.day--empty):not(.day--disabled):not(.weekday-label) {
      cursor: pointer;
      pointer-events: auto;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
    }
    .full-calendar__day.day--focused:not(.day--empty):not(.day--disabled):not(.weekday-label)::after,
    .full-calendar__day.day--today.day--focused:not(.day--empty):not(.day--disabled):not(.weekday-label)::after {
      opacity: 1;
    }

    .calendar-weekday > .weekday,
    .full-calendar__day > .calendar-day {
      display: flex;
      align-items: center;
      justify-content: center;

      position: absolute;
      top: 5%;
      left: 5%;
      width: 90%;
      height: 90%;
      color: currentColor;
      font-size: 14px;
      pointer-events: none;
      z-index: 1;
    }
    .full-calendar__day.day--today {
      color: var(--app-datepicker-accent-color, #1a73e8);
    }
    .full-calendar__day.day--focused,
    .full-calendar__day.day--today.day--focused {
      color: var(--app-datepicker-focused-day-color, #fff);
    }
    .full-calendar__day.day--empty,
    .full-calendar__day.weekday-label,
    .full-calendar__day.day--disabled > .calendar-day {
      pointer-events: none;
    }
    .full-calendar__day.day--disabled:not(.day--today) {
      color: var(--app-datepicker-disabled-day-color, rgba(0, 0, 0, .55));
    }

    .year-list-view__list-item {
      position: relative;
      width: 100%;
      padding: 12px 16px;
      text-align: center;
      /** NOTE: Reduce paint when hovering and scrolling, but this increases memory usage */
      /* will-change: opacity; */
      /* outline: none; */
    }
    .year-list-view__list-item::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: var(--app-datepicker-focused-year-bg-color, #000);
      opacity: 0;
      pointer-events: none;
    }
    .year-list-view__list-item:focus::after {
      opacity: .05;
    }
    .year-list-view__list-item.year--selected {
      color: var(--app-datepicker-accent-color, #1a73e8);
      font-size: 24px;
      font-weight: 500;
    }

    @media (any-hover: hover) {
      .btn__month-selector:hover,
      .year-list-view__list-item:hover {
        cursor: pointer;
      }
      .full-calendar__day:not(.day--empty):not(.day--disabled):not(.day--focused):not(.weekday-label):hover::after {
        opacity: .15;
      }
      .year-list-view__list-item:hover::after {
        opacity: .05;
      }
    }

    @supports (background: -webkit-canvas(squares)) {
      .calendar-container {
        padding: 56px 16px 16px;
      }

      table > caption {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate3d(-50%, 0, 0);
        will-change: transform;
      }
    }
    `,
    // tslint:enable:max-line-length
  ];

  @property({ type: Number, reflect: true })
  public firstDayOfWeek: number = 0;

  @property({ type: Boolean, reflect: true })
  public showWeekNumber: boolean = false;

  @property({ type: String, reflect: true })
  public weekNumberType: WeekNumberType = 'first-4-day-week';

  @property({ type: Boolean, reflect: true })
  public landscape: boolean = false;

  @property({ type: String, reflect: true })
  public get startView() {
    return this._startView!;
  }
  public set startView(val: StartView) {
    /**
     * NOTE: Defaults to `START_VIEW.CALENDAR` when `val` is falsy.
     */
    const defaultVal: StartView = !val ? 'calendar' : val;

    /**
     * NOTE: No-op when `val` is not falsy and not valid accepted values.
     */
    if (defaultVal !== 'calendar' && defaultVal !== 'yearList') return;

    const oldVal = this._startView;

    this._startView = defaultVal;
    this.requestUpdate('startView', oldVal);
  }

  @property({ type: String, reflect: true })
  public get min() {
    return this._hasMin ? toFormattedDateString(this._min!) : '';
  }
  public set min(val: string) {
    const valDate = getResolvedDate(val);
    const isValidMin = isValidDate(val, valDate);

    this._min = isValidMin ? valDate : this._todayDate;
    this._hasMin = isValidMin;
    this.requestUpdate('min');
  }

  @property({ type: String, reflect: true })
  public get max() {
    return this._hasMax ? toFormattedDateString(this._max!) : '';
  }
  public set max(val: string) {
    const valDate = getResolvedDate(val);
    const isValidMax = isValidDate(val, valDate);

    this._max = isValidMax ? valDate : this._maxDate;
    this._hasMax = isValidMax;
    this.requestUpdate('max');
  }

  @property({ type: String })
  public get value() {
    return toFormattedDateString(this._focusedDate);
  }
  public set value(val: string) {
    const valDate = getResolvedDate(val);
    const validValue = isValidDate(val, valDate) ? valDate : this._todayDate;

    this._focusedDate = new Date(validValue);
    this._selectedDate = this._lastSelectedDate = new Date(validValue);
    // this.valueAsDate = newDate;
    // this.valueAsNumber = +newDate;
  }

  @property({ type: String })
  public locale: string = getResolvedLocale();

  @property({ type: String })
  public disabledDays: string = '';

  @property({ type: String })
  public disabledDates: string = '';

  @property({ type: String })
  public weekLabel: string = 'Wk';

  @property({ type: Boolean })
  public inline: boolean = false;

  @property({ type: Number })
  public dragRatio: number = .15;

  public get datepickerBodyCalendarView() {
    return this.shadowRoot!.querySelector<HTMLDivElement>('.datepicker-body__calendar-view');
  }

  public get calendarsContainer() {
    return this.shadowRoot!.querySelector<HTMLDivElement>('.calendars-container');
  }

  @property({ type: Date, attribute: false })
  private _selectedDate: Date;

  @property({ type: Date, attribute: false })
  private _focusedDate: Date;

  @property({ type: String, attribute: false })
  private _startView?: StartView;

  @query('.year-list-view__full-list')
  private _yearViewFullList?: HTMLDivElement;

  @query('.btn__year-selector')
  private _buttonSelectorYear?: HTMLButtonElement;

  @query('.year-list-view__list-item')
  private _yearViewListItem?: HTMLButtonElement;

  private _min: Date;
  private _max: Date;
  private _hasMin: boolean = false;
  private _hasMax: boolean = false;
  private _todayDate: Date;
  private _maxDate: Date;
  private _yearList: number[];
  private _formatters: Formatters;
  private _disabledDaysSet: Set<number> = new Set();
  private _disabledDatesSet: Set<number> = new Set();
  private _lastSelectedDate?: Date;
  private _tracker?: Tracker;
  private _dx: number = -Infinity;
  private _hasNativeWebAnimation: boolean = 'animate' in HTMLElement.prototype;
  private _updatingDateWithKey: boolean = false;

  public constructor() {
    super();

    const todayDate = getResolvedDate();
    const allFormatters = getFormatters(this.locale);
    const formattedTodayDate = toFormattedDateString(todayDate);
    const max = getResolvedDate('2100-12-31');

    this.value = formattedTodayDate;
    this.startView = 'calendar';

    this._min = new Date(todayDate);
    this._max = new Date(max);
    this._todayDate = todayDate;
    this._maxDate = max;
    this._yearList = toYearList(todayDate, max);
    this._selectedDate = new Date(todayDate);
    this._focusedDate = new Date(todayDate);
    this._formatters = allFormatters;
  }

  public disconnectedCallback() {
    super.disconnectedCallback();

    if (this._tracker) {
      this._tracker.disconnect();
      this._tracker = undefined;
    }
  }

  protected render() {
    /**
     * NOTE: Update `_formatters` when `locale` changes.
     */
    if (this._formatters.locale !== this.locale) this._formatters = getFormatters(this.locale);

    /**
     * NOTE(motss): For perf reason, initialize all formatters for calendar rendering
     */
    const datepickerBodyContent: TemplateResult =
      'yearList' === this._startView ?
        this._renderDatepickerYearList() : this._renderDatepickerCalendar();
    const datepickerHeaderContent: null | TemplateResult = this.inline ?
      null :
      html`<div class="datepicker-header" part="header">${
        this._renderHeaderSelectorButton()
      }</div>`;

    return html`
    ${datepickerHeaderContent}
    <div class="datepicker-body" part="body">${cache(datepickerBodyContent)}</div>
    `;
  }

  protected firstUpdated() {
    let firstFocusableElement: HTMLElement;

    if ('calendar' === this._startView) {
      firstFocusableElement = (
        this.inline ?
          this.shadowRoot!.querySelector<HTMLButtonElement>('.btn__month-selector') :
          this._buttonSelectorYear
      )!;
    } else {
      firstFocusableElement = this._yearViewListItem!;
    }

    dispatchCustomEvent<DatepickerFirstUpdated>(
      this, 'datepicker-first-updated', { firstFocusableElement, value: this.value });
  }

  protected updated(changed: Map<keyof ParamUpdatedChanged, unknown>) {
    const startView = this._startView;

    if (changed.has('min') || changed.has('max')) {
      this._yearList = toYearList(this._min, this._max);

      if ('yearList' === startView) this.requestUpdate();

      /**
       * Reset 'value' when 'value' is not withing the date range.
       *
       * 1. Check if there is valid date range which has >= 1 day
       * 2. Check if 'value' < 'min'. If true, set to 'min'. Else, proceed to 3..
       * 3. Check if 'value' > 'max'. If true, set to 'max'.
       */
      const minTime = +this._min;
      const maxTime = +this._max;

      if (getDateRange(minTime, maxTime) > 864e5) {
        const focusedDateTime = +this._focusedDate;

        let newValue = focusedDateTime;

        if (focusedDateTime < minTime) newValue = minTime;
        if (focusedDateTime > maxTime) newValue = maxTime;

        this.value = toFormattedDateString(new Date(newValue));
      } else if (getDateRange(minTime, maxTime) === 0) {
        this._focusedDate = new Date(minTime);
        this.value = toFormattedDateString(new Date(minTime));
      }
    }

    if (changed.has('_startView') || changed.has('startView')) {
      if ('yearList' === startView) {
        const selectedYearScrollTop =
          48 * (this._selectedDate.getUTCFullYear() - this._min.getUTCFullYear() - 2);

        targetScrollTo(this._yearViewFullList!, { top: selectedYearScrollTop, left: 0 });
      }

      if ('calendar' === startView && null == this._tracker) {
        const calendarsContainer = this.calendarsContainer;

        let $down = false;
        let $move = false;
        let $transitioning = false;

        if (calendarsContainer) {
          const handlers: TrackerHandlers = {
            down: () => {
              if ($transitioning) return;

              $down = true;
              this._dx = 0;
            },
            move : (pointer, oldPointer) => {
              if ($transitioning || !$down) return;

              const dx = this._dx;
              const hasMin =
                (dx < 0 && hasClass(calendarsContainer, 'has-max-date')) ||
                (dx > 0 && hasClass(calendarsContainer, 'has-min-date'));

              if (!hasMin && Math.abs(dx) > 0 && $down) {
                $move = true;
                calendarsContainer.style.transform = `translateX(${makeNumberPrecise(dx)}px)`;
              }

              this._dx = hasMin ? 0 : dx + (pointer.x - oldPointer.x);
            },
            up: async (_$, _$$, ev) => {
              if ($down && $move) {
                const dx = this._dx;
                const maxWidth = calendarsContainer.getBoundingClientRect().width / 3;
                const didPassThreshold = Math.abs(dx) > (Number(this.dragRatio) * maxWidth);
                const transitionDuration = 350;
                const transitionEasing = 'cubic-bezier(0, 0, .4, 1)';
                const transformTo =
                  didPassThreshold ? makeNumberPrecise(maxWidth * (dx < 0 ? -1 : 1)) : 0;

                $transitioning = true;

                await animateElement(calendarsContainer, {
                  hasNativeWebAnimation: this._hasNativeWebAnimation,
                  keyframes: [
                    { transform: `translateX(${dx}px)` },
                    {
                      transform: `translateX(${transformTo}px)`,
                    },
                  ],
                  options: {
                    duration: transitionDuration,
                    easing: transitionEasing,
                  },
                });

                if (didPassThreshold) {
                  this._updateMonth(dx < 0 ? 'next' : 'previous').handleEvent();
                }

                $down = $move = $transitioning = false;
                this._dx = -Infinity;

                calendarsContainer.removeAttribute('style');
                dispatchCustomEvent(this, 'datepicker-animation-finished');
              } else if ($down) {
                this._updateFocusedDate(ev as MouseEvent);

                $down = $move = false;
                this._dx = -Infinity;
              }
            },
          };

          this._tracker = new Tracker(calendarsContainer, handlers);
        }
      }

      /**
       * When `_startView` is previously defined which means not first updated but switching from
       * another view, focus year selector button.
       */
      if (changed.get('_startView') && 'calendar' === startView) {
        this._focusElement('[part="year-selector"]');
      }
    }

    /**
     * Focus to new focused date when updating with keyboard.
     * It is to provide better support for screen reader.
     */
    if (this._updatingDateWithKey) {
      this._focusElement('[part="calendars"]:nth-of-type(2) .day--focused');
      this._updatingDateWithKey = false;
    }
  }

  private _focusElement(selector: string) {
    const focusedTarget = this.shadowRoot!.querySelector<HTMLElement>(selector);

    if (focusedTarget) focusedTarget.focus();
  }

  private _renderHeaderSelectorButton() {
    const { yearFormat, dateFormat } = this._formatters!;
    const isCalendarView = this.startView === 'calendar';
    const focusedDate = this._focusedDate;
    const formattedDate = dateFormat(focusedDate);
    const formatterFy = yearFormat(focusedDate);

    return html`
    <button
      class="${classMap({ 'btn__year-selector': true, selected: !isCalendarView })}"
      type="button"
      part="year-selector"
      data-view="${'yearList' as StartView}"
      @click="${this._updateView('yearList')}">${formatterFy}</button>

    <div class="datepicker-toolbar" part="toolbar">
      <button
        class="${classMap({ 'btn__calendar-selector': true, selected: isCalendarView })}"
        type="button"
        part="calendar-selector"
        data-view="${'calendar' as StartView}"
        @click="${this._updateView('calendar')}">${formattedDate}</button>
    </div>
    `;
  }

  private _renderDatepickerYearList() {
    const { yearFormat } = this._formatters;
    const focusedDateFy = this._focusedDate.getUTCFullYear();

    return html`
    <div class="datepicker-body__year-list-view" part="year-list-view">
      <div class="year-list-view__full-list" part="year-list" @click="${this._updateYear}">
      ${this._yearList.map(n =>
      html`<button
        class="${classMap({
          'year-list-view__list-item': true,
          'year--selected': focusedDateFy === n,
        })}"
        type="button"
        part="year"
        .year="${n}">${yearFormat(toUTCDate(n, 0, 1))}</button>`)
      }</div>
    </div>
    `;
  }

  private _renderDatepickerCalendar() {
    const {
      longMonthYearFormat,
      dayFormat,
      fullDateFormat,
      longWeekdayFormat,
      narrowWeekdayFormat,
    } = this._formatters;
    const disabledDays = splitString(this.disabledDays, Number);
    const disabledDates = splitString(this.disabledDates, getResolvedDate);
    const showWeekNumber = this.showWeekNumber;
    const $focusedDate = this._focusedDate;
    const firstDayOfWeek = this.firstDayOfWeek;
    const todayDate = getResolvedDate();
    const $selectedDate = this._selectedDate;
    const $max = this._max;
    const $min = this._min;

    const { calendars, disabledDaysSet, disabledDatesSet, weekdays } = getMultiCalendars({
      dayFormat,
      fullDateFormat,
      longWeekdayFormat,
      narrowWeekdayFormat,
      firstDayOfWeek,

      disabledDays,
      disabledDates,
      locale: this.locale,
      selectedDate: $selectedDate,
      showWeekNumber: this.showWeekNumber,
      weekNumberType: this.weekNumberType,
      max: $max,
      min: $min,
      weekLabel: this.weekLabel,
    });
    const hasMinDate = !calendars[0].calendar.length;
    const hasMaxDate = !calendars[2].calendar.length;

    const weekdaysContent = weekdays.map(
      o => html`<th
        class="calendar-weekday"
        part="calendar-weekday"
        role="columnheader"
        aria-label="${o.label}"
      >
        <div class="weekday" part="weekday">${o.value}</div>
      </th>`
    );
    const calendarsContent = repeat(calendars, n => n.key, ({ calendar }, ci) => {
      if (!calendar.length) {
        return html`<div class="calendar-container" part="calendar"></div>`;
      }

      const calendarAriaId = `calendarcaption${ci}`;
      const midCalendarFullDate = calendar[1][1].fullDate;
      const isMidCalendar = ci === 1;
      const $newFocusedDate: Date =
        isMidCalendar && !this._isInVisibleMonth($focusedDate, $selectedDate) ?
          computeNextFocusedDate({
            disabledDaysSet,
            disabledDatesSet,
            hasAltKey: false,
            keyCode: KEY_CODES_MAP.HOME,
            focusedDate: $focusedDate,
            selectedDate: $selectedDate,
            minTime: +$min,
            maxTime: +$max,
          }) :
          $focusedDate;

      return html`
      <div class="calendar-container" part="calendar">
        <table class="calendar-table" part="table" role="grid" aria-labelledby="${calendarAriaId}">
          <caption id="${calendarAriaId}">
            <div class="calendar-label" part="label">${
              midCalendarFullDate ? longMonthYearFormat(midCalendarFullDate) : ''
            }</div>
          </caption>

          <thead role="rowgroup">
            <tr class="calendar-weekdays" part="weekdays" role="row">${weekdaysContent}</tr>
          </thead>

          <tbody role="rowgroup">${
            calendar.map((calendarRow) => {
              return html`<tr role="row">${
                calendarRow.map((calendarCol, i) => {
                  const { disabled, fullDate, label, value } = calendarCol;

                  /** Week label, if any */
                  if (!fullDate && value && showWeekNumber && i < 1) {
                    return html`<th
                      class="full-calendar__day weekday-label"
                      part="calendar-day"
                      scope="row"
                      role="rowheader"
                      abbr="${label}"
                      aria-label="${label}"
                    >${value}</th>`;
                  }

                  /** Empty day */
                  if (!value || !fullDate) {
                    return html`<td class="full-calendar__day day--empty" part="calendar-day"></td>`;
                  }

                  const curTime = +new Date(fullDate);
                  const isCurrentDate = +$focusedDate === curTime;
                  const shouldTab = isMidCalendar && $newFocusedDate.getUTCDate() === Number(value);

                  return html`
                  <td
                    tabindex="${shouldTab ? '0' : '-1'}"
                    class="${classMap({
                      'full-calendar__day': true,
                      'day--disabled': disabled,
                      'day--today': +todayDate === curTime,
                      'day--focused': !disabled && isCurrentDate,
                    })}"
                    part="calendar-day"
                    role="gridcell"
                    aria-disabled="${disabled ? 'true' : 'false'}"
                    aria-label="${label}"
                    aria-selected="${isCurrentDate ? 'true' : 'false'}"
                    .fullDate="${fullDate}"
                    .day="${value}"
                  >
                    <div class="calendar-day" part="day">${value}</div>
                  </td>
                  `;
                })
              }</tr>`;
            })
          }</tbody>
        </table>
      </div>
      `;
    });

    /** NOTE: Updates disabled dates and days with computed Sets. */
    this._disabledDatesSet = disabledDatesSet;
    this._disabledDaysSet = disabledDaysSet;

    /**
     * FIXME(motss): Allow users to customize the aria-label for accessibility and i18n reason.
     */
    return html`
    <div class="datepicker-body__calendar-view" part="calendar-view">
      <div class="calendar-view__month-selector" part="month-selectors">
        <div class="month-selector-container">${hasMinDate ? null : html`
          <button
            class="btn__month-selector"
            type="button"
            part="month-selector"
            aria-label="Previous month"
            @click="${this._updateMonth('previous')}"
          >${iconChevronLeft}</button>
        `}</div>

        <div class="month-selector-container">${hasMaxDate ? null : html`
          <button
            class="btn__month-selector"
            type="button"
            part="month-selector"
            aria-label="Next month"
            @click="${this._updateMonth('next')}"
          >${iconChevronRight}</button>
        `}</div>
      </div>

      <div
        class="${classMap({
          'calendars-container': true,
          'has-min-date': hasMinDate,
          'has-max-date': hasMaxDate,
        })}"
        part="calendars"
        @keyup="${this._updateFocusedDateWithKeyboard}"
      >${calendarsContent}</div>
    </div>
    `;
  }

  private _updateView(view: StartView) {
    const handleUpdateView = () => {
      if ('calendar' === view) {
        this._selectedDate = this._lastSelectedDate =
          new Date(updateYearWithMinMax(this._focusedDate, this._min, this._max));
      }

      this._startView = view;
    };

    return passiveHandler(handleUpdateView);
  }

  private _updateMonth(updateType: MonthUpdateType) {
    const handleUpdateMonth = () => {
      const calendarsContainer = this.calendarsContainer;

      if (null == calendarsContainer) return this.updateComplete;

      const dateDate = this._lastSelectedDate || this._selectedDate;
      const minDate = this._min;
      const maxDate = this._max;

      const isPreviousMonth = updateType === 'previous';

      const newSelectedDate = toUTCDate(
        dateDate.getUTCFullYear(),
        dateDate.getUTCMonth() + (isPreviousMonth ? -1 : 1),
        1);
      const newSelectedDateFy = newSelectedDate.getUTCFullYear();
      const newSelectedDateM = newSelectedDate.getUTCMonth();

      const minDateFy = minDate.getUTCFullYear();
      const minDateM = minDate.getUTCMonth();

      const maxDateFy = maxDate.getUTCFullYear();
      const maxDateM = maxDate.getUTCMonth();

      /**
       * NOTE: Instead of debouncing/ throttling the animation when switching between
       * calendar months, this prevents subsequent animation that can cause an issue
       * where a blank calendar comes into view to be queued by ensuring the new updated
       * selected date's month always fall between the defined `_min` and `_max` values.
       * Not only does it prevents the aforementioned issue but also avoid adding too much
       * delay in between animations. Happy spamming the animations as you wish! 😄 🎉
       */
      const isLessThanYearAndMonth = newSelectedDateFy < minDateFy ||
        (newSelectedDateFy <= minDateFy && newSelectedDateM < minDateM);
      const isMoreThanYearAndMonth = newSelectedDateFy > maxDateFy ||
        (newSelectedDateFy >= maxDateFy && newSelectedDateM > maxDateM);
      if (isLessThanYearAndMonth || isMoreThanYearAndMonth) return this.updateComplete;

      /**
       * NOTE: This improves spamming animations via gestures but relying on another property
       * to keep track of the last/ latest selected date so that when you spam click on
       * the navigate next button 3 times, based on the expected mental model and behavior,
       * the calendar month should switch 3 times, e.g. Jan 2020 -> 3 clicks -> Apr 2020.
       */
      this._lastSelectedDate = newSelectedDate;
      this._selectedDate = this._lastSelectedDate!;

      return this.updateComplete;
    };

    return passiveHandler(handleUpdateMonth);
  }

  @eventOptions({ passive: true })
  private _updateYear(ev: MouseEvent) {
    const selectedYearEl = findShadowTarget<HTMLButtonElement>(
      ev,
      (n: HTMLElement) => hasClass(n, 'year-list-view__list-item')
    );

    if (selectedYearEl == null) return;

    /**
     * 2 things to do here:
     *  - Update `_selectedDate` and `_focusedDate` with update `year` value of old focused date
     *  - Update `_startView` to `START_VIEW.CALENDAR`
     */

    const newFocusedDate = updateYearWithMinMax(
      new Date(this._focusedDate).setUTCFullYear(+selectedYearEl.year),
      this._min,
      this._max
    );

    this._selectedDate = this._lastSelectedDate = new Date(newFocusedDate);
    this._focusedDate = new Date(newFocusedDate);
    this._startView = 'calendar';
  }

  private _updateFocusedDate(ev: MouseEvent) {
    const selectedDayEl = findShadowTarget<HTMLTableCellElement>(
      ev,
      (n: HTMLElement) => hasClass(n, 'full-calendar__day')
    );

    /** NOTE: Required condition check else these will trigger unwanted re-rendering */
    if (selectedDayEl == null ||
      [
        'day--empty',
        'day--disabled',
        'day--focused',
        'weekday-label',
      ].some(n => hasClass(selectedDayEl, n))) return;

    this._focusedDate = new Date(selectedDayEl.fullDate);

    dispatchCustomEvent<DatepickerValueUpdated>(this, 'datepicker-value-updated', {
      isKeypress: false,
      value: this.value,
    });
  }

  // Left Move focus to the previous day. Will move to the last day of the previous month,
  //  if the current day is the first day of a month.
  // Right Move focus to the next day. Will move to the first day of the following month,
  //  if the current day is the last day of a month.
  // Up Move focus to the same day of the previous week.
  //  Will wrap to the appropriate day in the previous month.
  // Down Move focus to the same day of the following week.
  //  Will wrap to the appropriate day in the following month.
  // PgUp Move focus to the same date of the previous month. If that date does not exist,
  //  focus is placed on the last day of the month.
  // PgDn Move focus to the same date of the following month. If that date does not exist,
  //  focus is placed on the last day of the month.
  // Alt+PgUp Move focus to the same date of the previous year.
  //  If that date does not exist (e.g leap year), focus is placed on the last day of the month.
  // Alt+PgDn Move focus to the same date of the following year.
  //  If that date does not exist (e.g leap year), focus is placed on the last day of the month.
  // Home Move to the first day of the month.
  // End Move to the last day of the month
  // Tab / Shift+Tab If the datepicker is in modal mode, navigate between calender grid and
  //  close/previous/next selection buttons, otherwise move to the field following/preceding the
  //  date textbox associated with the datepicker
  // Enter / Space Fill the date textbox with the selected date then close the datepicker widget.
  @eventOptions({ passive: true })
  private _updateFocusedDateWithKeyboard(ev: KeyboardEvent) {
    const keyCode = ev.keyCode;

    /** NOTE: Skip updating and fire an event to notify of updated focused date. */
    if (KEY_CODES_MAP.ENTER === keyCode || KEY_CODES_MAP.SPACE === keyCode) {
      dispatchCustomEvent<DatepickerValueUpdated>(this, 'datepicker-value-updated', {
        keyCode,

        isKeypress: true,
        value: this.value,
      });

      /**
       * Always update focused date to avoid the following scenario:
       *
       * 1. Navigate to March 2020 via mouse clicks
       * 2. Click to select '2020-03-30'
       * 3. Navigate to February 2020 via mouse clicks
       * 4. Tab to first focusable calendar day and hit Enter or Space
       * 5. Focused date should update to first focusable calendar day instead of '2020-03-20'
       */
      this._focusedDate = new Date(this._selectedDate);

      return;
    }

    /** NOTE: Skip for TAB key and other non-related keys */
    if (keyCode === KEY_CODES_MAP.TAB || !ALL_NAV_KEYS_SET.has(keyCode)) return;

    const selectedDate = this._selectedDate;
    const nextFocusedDate = computeNextFocusedDate({
      keyCode,
      selectedDate,

      disabledDatesSet: this._disabledDatesSet,
      disabledDaysSet: this._disabledDaysSet,
      focusedDate: this._focusedDate,
      hasAltKey: ev.altKey,
      maxTime: +this._max,
      minTime: +this._min,
    });

    /**
     * NOTE: Update `_selectedDate` and `_lastSelectedDate` if
     * new focused date is no longer in the same month or year.
     */
    if (!this._isInVisibleMonth(nextFocusedDate, selectedDate)) {
      this._selectedDate = this._lastSelectedDate = nextFocusedDate;
    }

    this._focusedDate = nextFocusedDate;
    this._updatingDateWithKey = true;

    dispatchCustomEvent<DatepickerValueUpdated>(this, 'datepicker-value-updated', {
      keyCode,

      isKeypress: true,
      value: this.value,
    });
  }

  private _isInVisibleMonth(dateA: Date, dateB: Date) {
    const dateAFy = dateA.getUTCFullYear();
    const dateAM = dateA.getUTCMonth();
    const dateBFY = dateB.getUTCFullYear();
    const dateBM = dateB.getUTCMonth();

    return dateAFy === dateBFY && dateAM === dateBM;
  }

}

declare global {
  // #region HTML element type extensions
  interface HTMLButtonElement {
    year: number;
  }

  interface HTMLElement {
    part: HTMLElementPart;
  }

  interface HTMLTableCellElement {
    day: string;
    fullDate: Date;
  }
  // #endregion HTML element type extensions

  interface HTMLElementEventMap {
    'datepicker-first-updated': CustomEvent<DatepickerFirstUpdated>;
    'datepicker-animation-finished': CustomEvent<undefined>;
    'datepicker-value-updated': CustomEvent<DatepickerValueUpdated>;
  }
}

// FIXED: To look into `passive` event listener option in future.
// FIXED: To reflect value on certain properties according to specs/ browser impl: min, max, value.
// FIXED: `disabledDates` are not supported
// FIXED: Updating `min` via attribute or property breaks entire UI
// FIXED: To improve date navigation using keyboard. Disabled date are selectable with Left, Right
//        arrows.
// FIXED: To add support for labels such week number for better i18n
// FIXED: To fix hardcoded `_yearList` when `min` has no initial value.
// FIXED: PgUp/ PgDown on new date that does not exist should fallback to last day of month.
// FIXED: Update year should update `_lastSelectedDate`
// FIXED: Showing blank calendar when updating year
// FIXED: Buggy condition check for max date when updating month
// FIXED: Gestures are broken on landscape mode.
// FIXED: `landscape` attribute breaks layout.
// FIXED: Do not update focused date while dragging/ swiping calendar
// FIXED: app-datepicker's initial-render.spec.ts fails for unknown reason
// FIXED: `disabledDays` is broken with `firstDayOfWeek`
// FIXED: When a new property is set, it re-renders the calendar to last focused date but
// FIXED: Add test for custom events never updates the selected date
// FIXED: Replace Web Animations for better support for animations on older browsers.
// FIXED: Keyboard navigate to next month (Mar) and click on left arrow, (Jan) is shown.
// FIXED: To finalize cases where focused date does not exist in current month for each key pressed
// TODO: To support `valueAsDate` and `valueAsNumber`.
// TODO: To support RTL layout.
