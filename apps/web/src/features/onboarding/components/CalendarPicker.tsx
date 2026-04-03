import '@/features/onboarding/components/CalendarPicker.css'
import { DayPicker } from 'react-day-picker'
import { ko } from 'date-fns/locale'
import { format, startOfDay, addDays, getDay } from 'date-fns'

interface CalendarPickerProps {
  selected: string | null
  onSelect: (date: string) => void
}

export function CalendarPicker({ selected, onSelect }: CalendarPickerProps) {
  const today = startOfDay(new Date())
  const rangeStart = addDays(today, -14)
  const rangeEnd = addDays(today, 90)
  const selectedDate = selected ? new Date(selected + 'T00:00:00') : undefined

  function handleSelect(date: Date | undefined) {
    if (date) {
      onSelect(format(date, 'yyyy-MM-dd'))
    }
  }

  return (
    <div className="cal">
      <DayPicker
        mode="single"
        locale={ko}
        navLayout="around"
        selected={selectedDate}
        onSelect={handleSelect}
        disabled={[{ before: rangeStart }, { after: rangeEnd }]}
        startMonth={rangeStart}
        endMonth={rangeEnd}
        today={today}
        modifiers={{
          sunday: (date) => getDay(date) === 0,
          saturday: (date) => getDay(date) === 6,
        }}
        modifiersClassNames={{
          sunday: 'rdp--sunday',
          saturday: 'rdp--saturday',
        }}
      />
    </div>
  )
}
