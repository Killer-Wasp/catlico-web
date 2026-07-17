import { Button, Group } from '@mantine/core'
import type { FormEvent } from 'react'
import { useId } from 'react'
import { AppDrawer } from './AppDrawer'
import type { AppDrawerProps } from './AppDrawer'

export type FormDrawerProps = Omit<AppDrawerProps, 'footer'> & {
  /** Fired on submit — button click *and* Enter in a field. */
  onSubmit: () => void
  submitLabel: string
  cancelLabel?: string
  loading?: boolean
  submitDisabled?: boolean
  /** Defaults to the orange used by the app's primary actions; "red" for destructive. */
  submitColor?: string
}

/**
 * AppDrawer plus the Cancel/Submit bar that was hand-written in every form modal.
 *
 * The bar is a sibling of the scrolling body, so the submit button sits outside
 * the <form> and is wired back to it by id — that association is what keeps both
 * the click and Enter-to-submit working.
 */
export function FormDrawer({
  onSubmit,
  submitLabel,
  cancelLabel = 'Cancel',
  loading,
  submitDisabled,
  submitColor = 'orange',
  onClose,
  children,
  ...rest
}: FormDrawerProps) {
  const formId = useId()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <AppDrawer
      onClose={onClose}
      footer={
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            color={submitColor}
            loading={loading}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </Group>
      }
      {...rest}
    >
      {/* noValidate: these forms came from Modals whose submit was a plain
          onClick, so `required` only ever drew Mantine's asterisk while the
          panel did its own validation. A real <form> would let native
          constraint validation block submit first, silently skipping that
          panel-level validation and its field-level error messages. */}
      <form id={formId} onSubmit={handleSubmit} noValidate>
        {children}
      </form>
    </AppDrawer>
  )
}
