import { Drawer, VisuallyHidden } from '@mantine/core'
import type { DrawerRootProps } from '@mantine/core'
import type { ReactNode } from 'react'
import classes from './AppDrawer.module.css'

/**
 * Canonical drawer widths. Every overlay picks one of these instead of an ad-hoc
 * pixel value, which is what let the previous drawers drift to 480 / 560 / "lg" /
 * "min(520px, 94vw)" / default. Each caps at 94vw so nothing overflows on narrow
 * screens.
 */
const SIZES = {
  sm: 'min(420px, 94vw)',
  md: 'min(560px, 94vw)',
  lg: 'min(720px, 94vw)',
  xl: 'min(960px, 94vw)',
  full: '90%',
} as const

export type AppDrawerSize = keyof typeof SIZES

export type AppDrawerProps = {
  opened: boolean
  onClose: () => void
  /** Rendered into Drawer.Title, which is what supplies the dialog's accessible name. */
  title: ReactNode
  size?: AppDrawerSize
  padding?: DrawerRootProps['padding']
  /** Action bar pinned to the bottom; content scrolls above it. */
  footer?: ReactNode
  /** Mantine colour name for a left-edge accent stripe, e.g. "red". */
  accent?: string
  /**
   * Set false when the content renders its own header (the observable and alert
   * detail rails do, with their own close control). `title` is then only used for
   * the dialog's accessible name, so keep passing it.
   */
  withHeader?: boolean
  children?: ReactNode
} & Pick<DrawerRootProps, 'closeOnClickOutside' | 'closeOnEscape' | 'trapFocus'>

/**
 * The single drawer shell for the app. Fixes position, size scale, overlay and
 * title treatment so callers cannot drift; pass `footer` for a pinned action bar
 * (see FormDrawer, which builds the standard Cancel/Submit bar on top of this).
 */
export function AppDrawer({
  opened,
  onClose,
  title,
  size = 'md',
  padding = 'lg',
  footer,
  accent,
  withHeader = true,
  children,
  ...rest
}: AppDrawerProps) {
  return (
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position="right"
      size={SIZES[size]}
      padding={padding}
      // Styling goes through `classNames`/`style` here rather than `className` on
      // Drawer.Content: Mantine's DrawerContent forwards a bare `className` to the
      // positioning wrapper (Drawer.Inner) as well as the content. Our flex-column
      // rule then flips the wrapper's axes, and `position="right"` lands
      // bottom-left at content width. `classNames` targets one element each.
      classNames={{
        content: accent ? `${classes.content} ${classes.accent}` : classes.content,
        body: classes.body,
      }}
      style={
        accent ? { '--app-drawer-accent': `var(--mantine-color-${accent}-6)` } : undefined
      }
      {...rest}
    >
      <Drawer.Overlay backgroundOpacity={0.35} blur={3} />
      <Drawer.Content>
        {withHeader ? (
          <Drawer.Header>
            <Drawer.Title>{title}</Drawer.Title>
            <Drawer.CloseButton />
          </Drawer.Header>
        ) : (
          // Drawer.Title still has to mount for aria-labelledby to resolve, so the
          // dialog keeps its accessible name even with the header chrome gone.
          <VisuallyHidden>
            <Drawer.Title>{title}</Drawer.Title>
          </VisuallyHidden>
        )}
        <Drawer.Body>{children}</Drawer.Body>
        {footer ? <div className={classes.footer}>{footer}</div> : null}
      </Drawer.Content>
    </Drawer.Root>
  )
}
