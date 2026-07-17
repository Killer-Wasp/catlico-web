/**
 * @vitest-environment jsdom
 *
 * Contract tests for the shared drawer primitives.
 *
 * The risky part of FormDrawer is that its action bar is a sibling of the
 * scrolling body, so the submit button lives *outside* the <form> and is bound
 * back to it by id. Nothing about that is visible at a call site, and if it
 * regresses the button silently stops submitting — hence these tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MantineProvider, TextInput } from '@mantine/core'
import { AppDrawer } from '#/components/ui/AppDrawer'
import { FormDrawer } from '#/components/ui/FormDrawer'

afterEach(cleanup)

const wrap = (ui: React.ReactNode) => <MantineProvider>{ui}</MantineProvider>

describe('AppDrawer', () => {
  it('exposes a dialog named by its title, so role+name queries keep working', async () => {
    render(
      wrap(
        <AppDrawer opened onClose={vi.fn()} title="Observable detail">
          <p>body</p>
        </AppDrawer>,
      ),
    )

    expect(
      await screen.findByRole('dialog', { name: /observable detail/i }),
    ).toBeTruthy()
  })

  it('keeps its layout class off Drawer.Inner, which positions the panel', async () => {
    // Mantine's DrawerContent forwards a bare `className` to both the content and
    // the inner positioning wrapper. Our flex-column rule on that wrapper flips its
    // axes, so position="right" renders bottom-left at content width. Guards the
    // classNames-not-className fix in AppDrawer.
    render(
      wrap(
        <AppDrawer opened onClose={vi.fn()} title="Positioned">
          <p>body</p>
        </AppDrawer>,
      ),
    )

    const dialog = await screen.findByRole('dialog', { name: /positioned/i })
    const inner = document.querySelector('.mantine-Drawer-inner')
    expect(inner).toBeTruthy()

    const layoutClass = [...dialog.classList].find((c) => c.includes('content'))
    expect(layoutClass).toBeTruthy()
    expect([...inner!.classList]).not.toContain(layoutClass)
  })

  it('renders a footer only when one is given', () => {
    const { rerender } = render(
      wrap(
        <AppDrawer opened onClose={vi.fn()} title="No footer">
          <p>body</p>
        </AppDrawer>,
      ),
    )
    expect(screen.queryByText('the-footer')).toBeNull()

    rerender(
      wrap(
        <AppDrawer opened onClose={vi.fn()} title="With footer" footer={<span>the-footer</span>}>
          <p>body</p>
        </AppDrawer>,
      ),
    )
    expect(screen.getByText('the-footer')).toBeTruthy()
  })
})

describe('FormDrawer', () => {
  const setup = (props: Partial<React.ComponentProps<typeof FormDrawer>> = {}) => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    render(
      wrap(
        <FormDrawer
          opened
          onClose={onClose}
          title="Add case status"
          submitLabel="Create status"
          onSubmit={onSubmit}
          {...props}
        >
          <TextInput label="Label" />
        </FormDrawer>,
      ),
    )
    return { onSubmit, onClose }
  }

  it('submits when the footer button is clicked, though it sits outside the form', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Create status' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits on Enter in a field', () => {
    const { onSubmit } = setup()
    fireEvent.submit(screen.getByLabelText('Label').closest('form')!)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not navigate away on submit (preventDefault)', () => {
    const { onSubmit } = setup()
    const form = screen.getByLabelText('Label').closest('form')!
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form.dispatchEvent(event)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('still submits when a required field is empty, leaving validation to the caller', () => {
    // These forms came from Modals whose submit was a plain onClick, so panels do
    // their own validation and surface their own field errors. Without noValidate
    // the browser would block submit on an empty `required` field and that panel
    // validation would never run.
    const onSubmit = vi.fn()
    render(
      wrap(
        <FormDrawer
          opened
          onClose={vi.fn()}
          title="Add notifier"
          submitLabel="Create notifier"
          onSubmit={onSubmit}
        >
          <TextInput label="Destination URL" required value="" onChange={() => {}} />
        </FormDrawer>,
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create notifier' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('cancel closes without submitting', () => {
    const { onSubmit, onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks submit while disabled', () => {
    const { onSubmit } = setup({ submitDisabled: true })
    fireEvent.click(screen.getByRole('button', { name: 'Create status' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
