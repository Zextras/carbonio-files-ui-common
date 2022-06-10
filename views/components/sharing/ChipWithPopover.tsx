/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useState } from 'react';

import {
	Popover,
	Chip,
	ChipProps,
	getColor,
	useCombinedRefs
} from '@zextras/carbonio-design-system';
import styled from 'styled-components';

const CustomPopover = styled(Popover)`
	z-index: 1000;
`;

const ActiveChip = styled(Chip)<{ $active: boolean }>`
	background: ${({ background, $active, theme }): string =>
		getColor(`${background}.${$active ? 'active' : 'regular'}`, theme)};
`;

export interface ChipWithPopoverProps extends ChipProps {
	openPopoverOnClick?: boolean;
	onClick?: (event: React.SyntheticEvent) => void;
	children: (closePopover: () => void) => JSX.Element;
}

export const ChipWithPopover = React.forwardRef<HTMLDivElement, ChipWithPopoverProps>(
	function ChipWithPopoverFn(
		{ onClose, background, openPopoverOnClick = true, onClick, children, ...rest },
		ref
	) {
		const innerRef = useCombinedRefs<HTMLDivElement>(ref);
		const [open, setOpen] = useState(false);

		const setOpenToFalse = useCallback(() => {
			if (open) {
				setOpen(false);
			}
		}, [open, setOpen]);

		const onCloseChip = useCallback(
			(ev: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
				if (innerRef && innerRef.current) {
					// required to close all opened popover
					innerRef.current.click();
				}
				if (onClose) {
					onClose(ev);
				}
			},
			[innerRef, onClose]
		);

		const onClickChip = useCallback<React.MouseEventHandler>(
			(ev) => {
				if (openPopoverOnClick && !open) {
					setOpen(true);
				}
				if (onClick) {
					onClick(ev);
				}
			},
			[openPopoverOnClick, open, onClick]
		);

		return (
			<>
				<div ref={innerRef} data-testid="chip-with-popover">
					<ActiveChip
						$active={open}
						background={background}
						onClose={onClose ? onCloseChip : undefined}
						onClick={openPopoverOnClick || onClick ? onClickChip : undefined}
						{...rest}
					/>
				</div>
				<CustomPopover
					open={openPopoverOnClick ? open : false}
					anchorEl={innerRef}
					styleAsModal
					placement="bottom-start"
					onClose={setOpenToFalse}
				>
					{children(setOpenToFalse)}
				</CustomPopover>
			</>
		);
	}
);
