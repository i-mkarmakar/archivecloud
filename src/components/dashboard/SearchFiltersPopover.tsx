"use client";

import type { DateValue } from "@internationalized/date";
import { parseDate } from "@internationalized/date";
import {
  Button,
  buttonVariants,
  DateField,
  DateRangePicker,
  Input,
  Label,
  Popover,
  RangeCalendar,
  Separator,
} from "@heroui/react";
import { Sliders } from "@gravity-ui/icons";

type ConnectedAccount = {
  id: string;
  email: string;
  provider: string;
};

type DateRange = {
  start: DateValue;
  end: DateValue;
};

function toCalendarDate(value: string): DateValue | null {
  if (!value) return null;
  try {
    return parseDate(value.slice(0, 10));
  } catch {
    return null;
  }
}

function FilterDatePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const start = toCalendarDate(startDate);
  const end = toCalendarDate(endDate);
  const value: DateRange | null = start && end ? { start, end } : null;

  return (
    <DateRangePicker
      className="w-full"
      granularity="day"
      value={value}
      onChange={(next) => {
        onStartChange(next?.start ? next.start.toString() : "");
        onEndChange(next?.end ? next.end.toString() : "");
      }}
    >
      <DateField.Group fullWidth variant="secondary">
        <DateField.InputContainer>
          <DateField.Input slot="start">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>
          <DateRangePicker.Trigger>
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DateRangePicker.Popover>
        <RangeCalendar aria-label="Date range">
          <RangeCalendar.Header>
            <RangeCalendar.YearPickerTrigger>
              <RangeCalendar.YearPickerTriggerHeading />
              <RangeCalendar.YearPickerTriggerIndicator />
            </RangeCalendar.YearPickerTrigger>
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => (
                <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
              )}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>
              {(date) => <RangeCalendar.Cell date={date} />}
            </RangeCalendar.GridBody>
          </RangeCalendar.Grid>
          <RangeCalendar.YearPickerGrid>
            <RangeCalendar.YearPickerGridBody>
              {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
            </RangeCalendar.YearPickerGridBody>
          </RangeCalendar.YearPickerGrid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

export function SearchFiltersPopover({
  accounts,
  filterKind,
  filterAccountId,
  filterMinSize,
  filterMaxSize,
  filterStartDate,
  filterEndDate,
  onFilterKindChange,
  onFilterAccountIdChange,
  onFilterMinSizeChange,
  onFilterMaxSizeChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onApply,
  onClear,
}: {
  accounts: ConnectedAccount[];
  filterKind: string;
  filterAccountId: string;
  filterMinSize: string;
  filterMaxSize: string;
  filterStartDate: string;
  filterEndDate: string;
  onFilterKindChange: (value: string) => void;
  onFilterAccountIdChange: (value: string) => void;
  onFilterMinSizeChange: (value: string) => void;
  onFilterMaxSizeChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const selectClass =
    "mt-1 block h-10 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm focus:border-border focus:bg-surface focus:outline-none";

  return (
    <Popover>
      <Popover.Trigger
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          isIconOnly: true,
          className: "inline-flex items-center justify-center",
        })}
        aria-label="Search filters"
      >
        <Sliders className="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Content
        placement="bottom start"
        className="w-[min(calc(100vw-2rem),32rem)] p-0"
      >
        <Popover.Dialog>
          <div className="flex items-center justify-between border-b border-separator px-4 py-3">
            <Popover.Heading className="text-sm font-extrabold">
              Advanced Search Filters
            </Popover.Heading>
            <Button variant="ghost" size="sm" onPress={onClear}>
              Clear All
            </Button>
          </div>

          <div className="grid gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  File Type
                </Label>
                <select
                  value={filterKind}
                  onChange={(e) => onFilterKindChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">All Types</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">Document</option>
                  <option value="archive">Archive</option>
                </select>
              </div>

              <div className="min-w-0">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Connected Account
                </Label>
                <select
                  value={filterAccountId}
                  onChange={(e) => onFilterAccountIdChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.email} ({acc.provider})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="min-w-0">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Size Range (MB)
              </Label>
              <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Min"
                  value={filterMinSize}
                  onChange={(e) => onFilterMinSizeChange(e.target.value)}
                  fullWidth
                  variant="secondary"
                  aria-label="Minimum size in MB"
                />
                <span className="px-0.5 text-center text-xs font-semibold text-muted">
                  to
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Max"
                  value={filterMaxSize}
                  onChange={(e) => onFilterMaxSizeChange(e.target.value)}
                  fullWidth
                  variant="secondary"
                  aria-label="Maximum size in MB"
                />
              </div>
            </div>

            <div className="min-w-0">
              <Label className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                Date Range
              </Label>
              <FilterDatePicker
                startDate={filterStartDate}
                endDate={filterEndDate}
                onStartChange={onFilterStartDateChange}
                onEndChange={onFilterEndDateChange}
              />
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-2 px-4 py-3">
            <Button variant="primary" size="sm" onPress={onApply}>
              Apply Filters
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
