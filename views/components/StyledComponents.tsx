/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Avatar, Container, Row, Text, getColor } from '@zextras/carbonio-design-system';
import styled, { css, SimpleInterpolation } from 'styled-components';

import {
	LIST_ITEM_AVATAR_HEIGHT,
	LIST_ITEM_AVATAR_HEIGHT_COMPACT,
	LIST_ITEM_AVATAR_ICON_HEIGHT,
	LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT
} from '../../constants';

export const DisplayerContentContainer = styled(Container)`
	padding-bottom: 32px;
`;

export const HoverContainer = styled(Row)`
	width: 100%;
`;

export const HoverBarContainer = styled(Row)`
	display: none;
	position: absolute;
	top: 0;
	right: 0;
	height: 45%;
	// set the width to start just after the avatar/file icon preview to not overlay the selection mode elements
	width: calc(
		100% - ${LIST_ITEM_AVATAR_HEIGHT}px - ${(props): string => props.theme.sizes.padding.small}
	);
	background: linear-gradient(
		to right,
		transparent,
		${({ theme }): string => theme.palette.gray6.hover}
	);
`;

export const ListItemContainer = styled(Container).attrs<
	{
		$contextualMenuActive: boolean;
		$disabled?: boolean;
	},
	{ backgroundColor?: string }
>(({ $contextualMenuActive, $disabled, theme }) => ({
	backgroundColor:
		($disabled && getColor('gray6.disabled', theme)) ||
		($contextualMenuActive && getColor('gray6.hover', theme)) ||
		undefined
}))<{
	$contextualMenuActive: boolean;
	$disabled?: boolean;
	$disableHover?: boolean;
}>`
	${HoverContainer} {
		background-color: ${({ backgroundColor }): SimpleInterpolation => backgroundColor};
	}
	${HoverBarContainer} {
		display: none;
	}

	${({ $disableHover, theme }): SimpleInterpolation =>
		!$disableHover &&
		css`
			&:hover {
				${HoverBarContainer} {
					display: flex;
				}

				${HoverContainer} {
					background-color: ${getColor('gray6.hover', theme)};
				}
			}
		`}
	${({ $disabled }): SimpleInterpolation =>
		!$disabled &&
		css`
			cursor: pointer;
		`}
`;

export const CheckedAvatar = styled(Avatar)`
	border-radius: 8px;
	height: ${LIST_ITEM_AVATAR_HEIGHT}px;
	width: ${LIST_ITEM_AVATAR_HEIGHT}px;
	flex: 0 0 auto;
	align-self: center;

	& > svg {
		width: 24px;
		height: 24px;
	}
`;

export const UncheckedAvatar = styled(Avatar)`
	border-radius: 8px;
	height: ${LIST_ITEM_AVATAR_HEIGHT}px;
	width: ${LIST_ITEM_AVATAR_HEIGHT}px;
	flex: 0 0 auto;
	align-self: center;
	border: 1px solid ${(props): string => props.theme.palette.primary.regular};
	box-sizing: border-box;
`;

export const FileIconPreview = styled(Avatar)<{ $compact?: boolean }>`
	border-radius: 8px;
	height: ${({ $compact }): number =>
		$compact ? LIST_ITEM_AVATAR_HEIGHT_COMPACT : LIST_ITEM_AVATAR_HEIGHT}px;
	width: ${({ $compact }): number =>
		$compact ? LIST_ITEM_AVATAR_HEIGHT_COMPACT : LIST_ITEM_AVATAR_HEIGHT}px;
	flex: 0 0 auto;
	align-self: center;

	& > svg {
		width: ${({ $compact }): number =>
			$compact ? LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT : LIST_ITEM_AVATAR_ICON_HEIGHT}px;
		height: ${({ $compact }): number =>
			$compact ? LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT : LIST_ITEM_AVATAR_ICON_HEIGHT}px;
		min-width: ${({ $compact }): number =>
			$compact ? LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT : LIST_ITEM_AVATAR_ICON_HEIGHT}px;
		min-height: ${({ $compact }): number =>
			$compact ? LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT : LIST_ITEM_AVATAR_ICON_HEIGHT}px;
	}
`;

export const CenteredText = styled(Text)<{ $width?: string }>`
	text-align: center;
	width: ${({ $width }): string => $width || 'auto'};
`;

export const InlineText = styled(Text)`
	display: inline;
`;

export const OverFlowHiddenRow = styled(Row)`
	overflow: hidden;
`;

export const ItalicText = styled(Text)`
	font-style: italic;
`;
