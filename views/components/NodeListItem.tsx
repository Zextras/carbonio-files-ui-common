/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useContext, useMemo, useState } from 'react';

import { Container, Icon, Padding, Row, Text } from '@zextras/carbonio-design-system';
import { PreviewsManagerContext } from '@zextras/carbonio-ui-preview';
import debounce from 'lodash/debounce';
import includes from 'lodash/includes';
import some from 'lodash/some';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useSendViaMail } from '../../../hooks/useSendViaMail';
import useUserInfo from '../../../hooks/useUserInfo';
import {
	DISPLAYER_TABS,
	DOUBLE_CLICK_DELAY,
	LIST_ITEM_AVATAR_HEIGHT,
	LIST_ITEM_HEIGHT,
	LIST_ITEM_HEIGHT_COMPACT,
	PREVIEW_MAX_SIZE,
	PREVIEW_TYPE,
	ROOTS
} from '../../constants';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import { Action } from '../../types/common';
import { NodeType, User } from '../../types/graphql/types';
import { ActionItem, buildActionItems } from '../../utils/ActionsFactory';
import {
	downloadNode,
	formatDate,
	getIconByFileType,
	getPdfPreviewSrc,
	getImgPreviewSrc,
	getListItemAvatarPictureUrl,
	humanFileSize,
	openNodeWithDocs,
	getDocumentPreviewSrc,
	isSupportedByPreview,
	isSearchView
} from '../../utils/utils';
import { ContextualMenu } from './ContextualMenu';
import { NodeAvatarIcon } from './NodeAvatarIcon';
import { NodeHoverBar } from './NodeHoverBar';
import {
	FlexContainer,
	HoverBarContainer,
	HoverContainer,
	ListItemContainer
} from './StyledComponents';

const CustomText = styled(Text)`
	text-transform: uppercase;
`;

interface NodeListItemProps {
	id: string;
	name: string;
	type: NodeType;
	extension?: string | null;
	mimeType?: string;
	updatedAt?: number;
	size?: number;
	owner?: User;
	lastEditor?: User | null;
	incomingShare?: boolean;
	outgoingShare?: boolean;
	linkActive?: boolean;
	flagActive?: boolean;
	toggleFlagTrue?: () => void;
	toggleFlagFalse?: () => void;
	markNodesForDeletionCallback?: () => void;
	restoreNodeCallback?: () => void;
	moveNodesCallback?: () => void;
	copyNodesCallback?: () => void;
	manageSharesCallback?: () => void;
	// Selection props
	isSelected?: boolean;
	isSelectionModeActive?: boolean;
	selectId?: (id: string) => void;
	permittedHoverBarActions?: Action[];
	permittedContextualMenuActions?: Action[];
	renameNode?: () => void;
	isActive?: boolean;
	setActive?: (event: React.SyntheticEvent) => void;
	compact?: boolean;
	navigateTo?: (id: string, event?: React.SyntheticEvent) => void;
	disabled?: boolean;
	selectable?: boolean;
	trashed?: boolean;
	deletePermanentlyCallback?: () => void;
	selectionContextualMenuActionsItems?: ActionItem[];
	dragging?: boolean;
	version?: number;
}

const NodeListItemComponent: React.VFC<NodeListItemProps> = ({
	id,
	name,
	type,
	extension,
	mimeType,
	updatedAt,
	size,
	owner,
	lastEditor,
	incomingShare = false,
	outgoingShare = false,
	linkActive = false,
	flagActive = false,
	toggleFlagTrue,
	toggleFlagFalse,
	markNodesForDeletionCallback,
	restoreNodeCallback,
	moveNodesCallback,
	copyNodesCallback,
	manageSharesCallback,
	// Selection props
	isSelected,
	isSelectionModeActive,
	selectId,
	permittedHoverBarActions = [],
	permittedContextualMenuActions = [],
	renameNode,
	isActive,
	setActive = (): void => undefined,
	compact,
	navigateTo = (): void => undefined,
	disabled = false,
	selectable = true,
	trashed,
	deletePermanentlyCallback,
	selectionContextualMenuActionsItems,
	dragging = false,
	version
}) => {
	const [t] = useTranslation();
	const { createPreview } = useContext(PreviewsManagerContext);
	const { setActiveNode } = useActiveNode();
	const location = useLocation();
	const userInfo = useUserInfo();
	const [isContextualMenuActive, setIsContextualMenuActive] = useState(false);
	const selectIdCallback = useCallback(
		(event: React.SyntheticEvent) => {
			if (selectId) {
				event.preventDefault();
				selectId(id);
			}
		},
		[id, selectId]
	);

	const createSnackbar = useCreateSnackbar();

	const { sendViaMail } = useSendViaMail();

	const sendViaMailCallback = useCallback(() => {
		sendViaMail(id);
	}, [id, sendViaMail]);

	const isNavigable = useMemo(
		() =>
			type === NodeType.Folder || type === NodeType.Root || some(ROOTS, (rootId) => rootId === id),
		[id, type]
	);

	const [$isSupportedByPreview, documentType] = useMemo<
		[boolean, typeof PREVIEW_TYPE[keyof typeof PREVIEW_TYPE] | undefined]
	>(() => isSupportedByPreview(mimeType), [mimeType]);

	const openNode = useCallback(
		(event: React.SyntheticEvent) => {
			// remove text selection on double click
			if (window.getSelection) {
				const selection = window.getSelection();
				selection && selection.removeAllRanges();
			}

			if (!isSelectionModeActive && !disabled && !trashed) {
				if (isNavigable) {
					navigateTo(id, event);
				} else if (includes(permittedContextualMenuActions, Action.Edit)) {
					// if can be opened with docs on edit mode, open editor
					openNodeWithDocs(id);
				} else if ($isSupportedByPreview) {
					const actions = [
						{
							icon: 'ShareOutline',
							id: 'ShareOutline',
							tooltipLabel: t('preview.actions.tooltip.manageShares', 'Manage Shares'),
							onClick: (): void => setActiveNode(id, DISPLAYER_TABS.sharing)
						},
						{
							icon: 'DownloadOutline',
							tooltipLabel: t('preview.actions.tooltip.download', 'Download'),
							id: 'DownloadOutline',
							onClick: (): void => downloadNode(id)
						}
					];
					const closeAction = {
						id: 'close-action',
						icon: 'ArrowBackOutline',
						tooltipLabel: t('preview.close.tooltip', 'Close')
					};
					if (documentType === PREVIEW_TYPE.IMAGE) {
						createPreview({
							previewType: 'image',
							filename: name,
							extension: extension || undefined,
							size: (size && humanFileSize(size)) || undefined,
							actions,
							closeAction,
							src: version ? getImgPreviewSrc(id, version, 0, 0, 'high') : ''
						});
					} else {
						// if supported, open document with preview
						const src =
							(version &&
								((documentType === PREVIEW_TYPE.PDF && getPdfPreviewSrc(id, version)) ||
									(documentType === PREVIEW_TYPE.DOCUMENT &&
										getDocumentPreviewSrc(id, version)))) ||
							'';
						if (includes(permittedContextualMenuActions, Action.OpenWithDocs)) {
							actions.unshift({
								id: 'OpenWithDocs',
								icon: 'BookOpenOutline',
								tooltipLabel: t('actions.openWithDocs', 'Open document'),
								onClick: (): void => openNodeWithDocs(id)
							});
						}
						createPreview({
							previewType: 'pdf',
							filename: name,
							extension: extension || undefined,
							size: (size !== undefined && humanFileSize(size)) || undefined,
							useFallback: size !== undefined && size > PREVIEW_MAX_SIZE,
							actions,
							closeAction,
							src
						});
					}
				} else if (includes(permittedContextualMenuActions, Action.OpenWithDocs)) {
					// if preview is not supported and document can be opened with docs, open editor
					openNodeWithDocs(id);
				}
			}
		},
		[
			isSelectionModeActive,
			disabled,
			trashed,
			isNavigable,
			$isSupportedByPreview,
			permittedContextualMenuActions,
			navigateTo,
			id,
			createPreview,
			name,
			extension,
			size,
			t,
			version,
			setActiveNode,
			documentType
		]
	);

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.Edit]: {
				id: 'Edit',
				icon: 'Edit2Outline',
				label: t('actions.edit', 'Edit'),
				click: (): void => {
					openNodeWithDocs(id);
				}
			},
			[Action.Preview]: {
				id: 'Preview',
				icon: 'MaximizeOutline',
				label: t('actions.preview', 'Preview'),
				click: openNode
			},
			[Action.SendViaMail]: {
				id: 'SendViaMail',
				icon: 'EmailOutline',
				label: t('actions.sendViaMail', 'Send via mail'),
				click: sendViaMailCallback
			},
			[Action.Download]: {
				id: 'Download',
				icon: 'Download',
				label: t('actions.download', 'Download'),
				click: (): void => {
					// download node without version to be sure last version is downloaded
					downloadNode(id);
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.download.start', 'Your download will start soon'),
						replace: true,
						hideButton: true
					});
				}
			},
			[Action.ManageShares]: {
				id: 'ManageShares',
				icon: 'ShareOutline',
				label: t('actions.manageShares', 'Manage Shares'),
				click: manageSharesCallback
			},
			[Action.Flag]: {
				id: 'Flag',
				icon: 'FlagOutline',
				label: t('actions.flag', 'Flag'),
				click: toggleFlagTrue
			},
			[Action.UnFlag]: {
				id: 'Unflag',
				icon: 'UnflagOutline',
				label: t('actions.unflag', 'Unflag'),
				click: toggleFlagFalse
			},
			[Action.OpenWithDocs]: {
				id: 'OpenWithDocs',
				icon: 'BookOpenOutline',
				label: t('actions.openWithDocs', 'Open document'),
				click: (): void => {
					openNodeWithDocs(id);
				}
			},
			[Action.Copy]: {
				id: 'Copy',
				icon: 'Copy',
				label: t('actions.copy', 'Copy'),
				click: copyNodesCallback
			},
			[Action.Move]: {
				id: 'Move',
				icon: 'MoveOutline',
				label: t('actions.move', 'Move'),
				click: moveNodesCallback
			},
			[Action.Rename]: {
				id: 'Rename',
				icon: 'Edit2Outline',
				label: t('actions.rename', 'Rename'),
				click: renameNode
			},
			[Action.MoveToTrash]: {
				id: 'MarkForDeletion',
				icon: 'Trash2Outline',
				label: t('actions.moveToTrash', 'Move to Trash'),
				click: markNodesForDeletionCallback
			},
			[Action.Restore]: {
				id: 'Restore',
				icon: 'RestoreOutline',
				label: t('actions.restore', 'Restore'),
				click: restoreNodeCallback
			},
			[Action.DeletePermanently]: {
				id: 'DeletePermanently',
				icon: 'DeletePermanentlyOutline',
				label: t('actions.deletePermanently', 'Delete Permanently'),
				click: deletePermanentlyCallback
			}
		}),
		[
			t,
			openNode,
			sendViaMailCallback,
			manageSharesCallback,
			toggleFlagTrue,
			toggleFlagFalse,
			copyNodesCallback,
			moveNodesCallback,
			renameNode,
			markNodesForDeletionCallback,
			restoreNodeCallback,
			deletePermanentlyCallback,
			id,
			createSnackbar
		]
	);

	const permittedHoverBarActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedHoverBarActions),
		[itemsMap, permittedHoverBarActions]
	);

	const permittedContextualMenuActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedContextualMenuActions),
		[itemsMap, permittedContextualMenuActions]
	);

	const setActiveDebounced = useMemo(
		() =>
			debounce(
				(event: React.SyntheticEvent) => {
					setActive(event);
				},
				DOUBLE_CLICK_DELAY,
				{ leading: false, trailing: true }
			),
		[setActive]
	);

	const doubleClickHandler = useCallback(
		(event: React.SyntheticEvent) => {
			setActiveDebounced.cancel();
			openNode(event);
		},
		[openNode, setActiveDebounced]
	);

	const displayName = useMemo(() => {
		if (lastEditor && lastEditor.id !== owner?.id) {
			return lastEditor.full_name;
		}
		if (owner && owner.id !== userInfo.me) {
			return owner.full_name;
		}
		return '';
	}, [lastEditor, owner, userInfo.me]);

	const openContextualMenuHandler = useCallback(() => {
		setIsContextualMenuActive(true);
	}, []);

	const closeContextualMenuHandler = useCallback(() => {
		setIsContextualMenuActive(false);
	}, []);

	const preventTextSelection = useCallback<React.MouseEventHandler>((e: React.MouseEvent): void => {
		if (e.detail > 1) {
			e.preventDefault();
		}
	}, []);

	return (
		<Container id={id}>
			<ContextualMenu
				disabled={
					(disabled || isSelectionModeActive || compact) &&
					selectionContextualMenuActionsItems === undefined
				}
				onOpen={openContextualMenuHandler}
				onClose={closeContextualMenuHandler}
				actions={selectionContextualMenuActionsItems || permittedContextualMenuActionsItems}
			>
				<ListItemContainer
					height="fit"
					onClick={compact ? setActive : setActiveDebounced}
					onDoubleClick={doubleClickHandler}
					data-testid={`node-item-${id}`}
					crossAlignment="flex-end"
					contextualMenuActive={isContextualMenuActive}
					disableHover={isContextualMenuActive || dragging || disabled}
					disabled={disabled}
					onMouseDown={preventTextSelection}
				>
					<HoverContainer
						height={compact ? LIST_ITEM_HEIGHT_COMPACT : LIST_ITEM_HEIGHT}
						wrap="nowrap"
						mainAlignment="flex-start"
						crossAlignment="center"
						padding={{ all: 'small' }}
						width="fill"
						background={isActive ? 'highlight' : 'gray6'}
					>
						<NodeAvatarIcon
							selectionModeActive={isSelectionModeActive}
							selected={isSelected}
							onClick={selectIdCallback}
							compact={compact}
							disabled={disabled}
							selectable={selectable}
							icon={getIconByFileType(type, mimeType || id)}
							picture={getListItemAvatarPictureUrl(id, version, type, mimeType)}
						/>
						<Container
							orientation="vertical"
							crossAlignment="flex-start"
							mainAlignment="space-around"
							padding={{ left: 'large' }}
							minWidth="auto"
							width="fill"
							maxWidth={`calc(100% - ${LIST_ITEM_AVATAR_HEIGHT}px)`}
						>
							<Row
								padding={{ vertical: 'extrasmall' }}
								width="fill"
								wrap="nowrap"
								mainAlignment="space-between"
							>
								<Text overflow="ellipsis" disabled={disabled} size="medium">
									{name}
								</Text>
								{!compact && (
									<Container orientation="horizontal" mainAlignment="flex-end" width="fit">
										{flagActive && (
											<Padding left="extrasmall">
												<Icon icon="Flag" color="error" disabled={disabled} />
											</Padding>
										)}
										{linkActive && (
											<Padding left="extrasmall">
												<Icon icon="Link2" disabled={disabled} />
											</Padding>
										)}
										{incomingShare && (
											<Padding left="extrasmall">
												<Icon icon="ArrowCircleLeft" customColor="#AB47BC" disabled={disabled} />
											</Padding>
										)}
										{outgoingShare && (
											<Padding left="extrasmall">
												<Icon icon="ArrowCircleRight" customColor="#FFB74D" disabled={disabled} />
											</Padding>
										)}
										{trashed && isSearchView(location) && (
											<Padding left="extrasmall">
												<Icon icon="Trash2Outline" disabled={disabled} />
											</Padding>
										)}
										<Padding left="extrasmall">
											<Text size="extrasmall" color="gray1" disabled={disabled}>
												{formatDate(updatedAt, undefined, userInfo.zimbraPrefTimeZoneId)}
											</Text>
										</Padding>
									</Container>
								)}
							</Row>
							{!compact && (
								<Row
									padding={{ vertical: 'extrasmall' }}
									width="fill"
									wrap="nowrap"
									mainAlignment="flex-start"
								>
									<FlexContainer
										$flexShrink={0}
										$flexGrow={1}
										$flexBasis="auto"
										mainAlignment="flex-start"
										orientation="horizontal"
										width="fit"
									>
										<CustomText color="gray1" disabled={disabled} size="small">
											{/* i18next-extract-disable-next-line */}
											{extension || t(`node.type.${type.toLowerCase()}`, type)}
										</CustomText>
										{size != null && (
											<Padding left="small">
												<CustomText color="gray1" disabled={disabled} size="small">
													{humanFileSize(size)}
												</CustomText>
											</Padding>
										)}
									</FlexContainer>
									{displayName && (
										<FlexContainer
											width="fit"
											minWidth={0}
											$flexShrink={1}
											$flexGrow={1}
											$flexBasis="auto"
											orientation="horizontal"
											mainAlignment="flex-end"
											padding={{ left: 'small' }}
										>
											<Text size="extrasmall" overflow="ellipsis">
												{displayName}
											</Text>
										</FlexContainer>
									)}
								</Row>
							)}
						</Container>
					</HoverContainer>

					{!compact && !isSelectionModeActive && !dragging && (
						<HoverBarContainer
							wrap="nowrap"
							mainAlignment="flex-end"
							height="fill"
							data-testid="hover-bar"
						>
							<NodeHoverBar actions={permittedHoverBarActionsItems} />
						</HoverBarContainer>
					)}
				</ListItemContainer>
			</ContextualMenu>
		</Container>
	);
};

export const NodeListItem = React.memo(NodeListItemComponent);
