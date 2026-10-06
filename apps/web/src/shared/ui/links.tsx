import {
  Button,
  ButtonBase,
  ListItemButton,
  type ButtonBaseProps,
  type ButtonProps,
  type ListItemButtonProps,
} from '@mui/material';
import { createLink } from '@tanstack/react-router';
import { forwardRef } from 'react';

/** Кнопки MUI як типобезпечні посилання роутера (з перевіркою `to` і `params`). */
const MuiButtonAnchor = forwardRef<HTMLAnchorElement, ButtonProps<'a'>>(
  ({ href, ...rest }, ref) => <Button ref={ref} component="a" href={href ?? ''} {...rest} />,
);
MuiButtonAnchor.displayName = 'MuiButtonAnchor';
export const LinkButton = createLink(MuiButtonAnchor);

const MuiListItemAnchor = forwardRef<HTMLAnchorElement, ListItemButtonProps<'a'>>(
  ({ href, ...rest }, ref) => (
    <ListItemButton ref={ref} component="a" href={href ?? ''} {...rest} />
  ),
);
MuiListItemAnchor.displayName = 'MuiListItemAnchor';
export const LinkListItem = createLink(MuiListItemAnchor);

const MuiBaseAnchor = forwardRef<HTMLAnchorElement, ButtonBaseProps<'a'>>(
  ({ href, ...rest }, ref) => <ButtonBase ref={ref} component="a" href={href ?? ''} {...rest} />,
);
MuiBaseAnchor.displayName = 'MuiBaseAnchor';
/** Безстильова кнопка-посилання (пункти навігації, картки): ролі й фокус — як у `<a>`. */
export const LinkBase = createLink(MuiBaseAnchor);
