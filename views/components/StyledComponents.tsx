/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Avatar, Button, Container, IconButton, Row, Text } from '@zextras/carbonio-design-system';
import styled, { css, FlattenSimpleInterpolation } from 'styled-components';

import { LIST_ITEM_AVATAR_HEIGHT } from '../../constants';

export const DisplayerContentContainer = styled(Container)`
	padding-bottom: 32px;
`;

export const ScrollContainer = styled(Container)`
	overflow-y: auto;
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

export const ListItemContainer = styled(Container).attrs(
	({ contextualMenuActive, disabled, theme }) => ({
		backgroundColor:
			(disabled && theme.palette.gray5.disabled) ||
			(contextualMenuActive && theme.palette.gray6.hover)
	})
)`
	${HoverContainer} {
		background-color: ${(props): string => props.backgroundColor};
	}
	${HoverBarContainer} {
		display: none;
	}

	${({ disableHover, theme }): string | FlattenSimpleInterpolation =>
		(!disableHover &&
			css`
				cursor: pointer;
				&:hover {
					${HoverBarContainer} {
						display: flex;
					}

					${HoverContainer} {
						background-color: ${theme.palette.gray6.hover};
					}
				}
			`) ||
		''}
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

export const FileIconPreview = styled(Avatar)`
	border-radius: 8px;
	height: ${LIST_ITEM_AVATAR_HEIGHT}px;
	width: ${LIST_ITEM_AVATAR_HEIGHT}px;
	flex: 0 0 auto;
	align-self: center;

	& > svg {
		color: ${(props): string => props.theme.palette.gray1.regular} !important;
		width: 24px;
		height: 24px;
	}
`;

export const RoundedButton = styled(Button)`
	border-radius: 50px;
	padding: 4px;
	& > div {
		font-size: ${({ theme }): string => theme.sizes.font.small};
	}
`;

export const CenteredText = styled(Text)`
	text-align: center;
	width: ${({ width }): string => width || 'auto'};
`;

export const InlineText = styled(Text)`
	display: inline;
`;

export const RotatedIconButton = styled(IconButton)`
	 {
		svg {
			transform: ${({ degrees }): string => `rotate(${degrees}deg)`};
		}
	}
`;

export const OverFlowHiddenRow = styled(Row)`
	overflow: hidden;
`;

export const ItalicText = styled(Text)`
	font-style: italic;
`;
