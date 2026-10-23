'use client';
import { useContext, useState, type InputHTMLAttributes } from 'react';
import {
  DatePicker,
  DateInput,
  DateSegment,
  Group,
  Button,
  Popover,
  Dialog,
  Calendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
  Heading,
  Label,
  I18nProvider,
  TimeField,
  FieldError,
  type DateValue,
} from 'react-aria-components';
import {
  parseDate,
  parseDateTime,
  today,
  getLocalTimeZone,
  toCalendarDateTime,
  toTime,
} from '@internationalized/date';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { ControlLabelContext } from './select-control';
import '@/styles/date-control.css';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'
> & {
  type?: 'date' | 'datetime-local';
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onChange?: (event: { target: { value: string } }) => void;
};

export function DateControl({
  type = 'date',
  value,
  defaultValue,
  min,
  max,
  onChange,
  id,
  name,
  required,
  disabled,
  readOnly,
  className = '',
  ...props
}: Props) {
  const fieldLabel = useContext(ControlLabelContext);
  const label = props['aria-label'] ?? fieldLabel ?? 'Fecha';
  const withTime = type === 'datetime-local';
  const parse = (raw?: string): DateValue | null => {
    if (!raw) return null;
    try {
      return withTime ? parseDateTime(raw) : parseDate(raw);
    } catch {
      return null;
    }
  };
  const [local, setLocal] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const selected = parse(value ?? local);
  const change = (next: DateValue | null) => {
    const raw = next ? next.toString().slice(0, withTime ? 16 : 10) : '';
    setLocal(raw);
    onChange?.({ target: { value: raw } });
  };
  return (
    <I18nProvider locale="es-BO">
      <DatePicker
        id={id}
        className={`brand-date ${className}`}
        name={name}
        value={selected}
        onChange={change}
        minValue={parse(min) ?? undefined}
        maxValue={parse(max) ?? undefined}
        isRequired={required}
        isDisabled={disabled}
        isReadOnly={readOnly}
        granularity={withTime ? 'minute' : 'day'}
        hourCycle={24}
        shouldForceLeadingZeros
        placeholderValue={withTime ? toCalendarDateTime(today(getLocalTimeZone())) : undefined}
        isOpen={open}
        onOpenChange={setOpen}
        shouldCloseOnSelect={!withTime}
        aria-describedby={props['aria-describedby']}
      >
        <Label className="sr-only">{label}</Label>
        <Group className="brand-date-field">
          <DateInput className="brand-date-input">
            {(segment) => <DateSegment segment={segment} className="brand-date-segment" />}
          </DateInput>
          <Button className="brand-date-trigger" aria-label="Abrir calendario">
            <CalendarDays size={19} aria-hidden="true" />
          </Button>
        </Group>
        <FieldError className="field-error" />
        <Popover className="brand-date-popover" placement="bottom start" offset={8}>
          <Dialog aria-label={`Elegir ${label.toLowerCase()}`} className="brand-date-dialog">
            <Calendar firstDayOfWeek="mon">
              <header className="brand-calendar-header">
                <Button slot="previous" className="brand-calendar-nav">
                  <ChevronLeft size={18} />
                </Button>
                <Heading />
                <Button slot="next" className="brand-calendar-nav">
                  <ChevronRight size={18} />
                </Button>
              </header>
              <CalendarGrid className="brand-calendar-grid" weekdayStyle="short">
                <CalendarGridHeader>
                  {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => <CalendarCell date={date} className="brand-calendar-day" />}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>
            {withTime && (
              <TimeField
                className="brand-calendar-time"
                hourCycle={24}
                granularity="minute"
                value={selected && 'hour' in selected ? toTime(selected) : null}
                onChange={(time) => {
                  if (time) change(toCalendarDateTime(selected ?? today(getLocalTimeZone()), time));
                }}
              >
                <Label>
                  <Clock3 size={16} aria-hidden="true" /> Hora
                </Label>
                <DateInput className="brand-date-input">
                  {(segment) => <DateSegment segment={segment} className="brand-date-segment" />}
                </DateInput>
              </TimeField>
            )}
            <div className="brand-calendar-footer">
              <Button
                className="button ghost small"
                onPress={() =>
                  change(
                    withTime
                      ? toCalendarDateTime(
                          today(getLocalTimeZone()),
                          selected && 'hour' in selected ? toTime(selected) : undefined,
                        )
                      : today(getLocalTimeZone()),
                  )
                }
              >
                Hoy
              </Button>
              {!required && (
                <Button
                  className="button ghost small"
                  onPress={() => {
                    change(null);
                    setOpen(false);
                  }}
                >
                  Borrar
                </Button>
              )}
              <Button className="button small" onPress={() => setOpen(false)}>
                Listo
              </Button>
            </div>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}
