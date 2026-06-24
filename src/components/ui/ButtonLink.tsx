/**
 * A Mantine `Button` that is also a fully type-safe TanStack Router link.
 *
 * Mantine's polymorphic `component={Link}` prop loses the registered router
 * type, degrading `params`/`search` to `AnyRouter` (so typed `params` objects
 * are rejected). Wrapping the button with `createLink` restores end-to-end
 * route, params, and search typing. Prefer this over `<Button component={Link}>`
 * whenever the link needs `params` or `search`.
 */
import { Button } from '@mantine/core'
import type { ButtonProps } from '@mantine/core'
import { createLink } from '@tanstack/react-router'
import { forwardRef } from 'react'
import type { AnchorHTMLAttributes } from 'react'

type ButtonLinkBaseProps = ButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonProps | 'color'>

const ButtonLinkBase = forwardRef<HTMLAnchorElement, ButtonLinkBaseProps>(
  function ButtonLinkBase(props, ref) {
    return <Button ref={ref} component="a" {...props} />
  },
)

export const ButtonLink = createLink(ButtonLinkBase)
