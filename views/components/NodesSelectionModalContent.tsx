/* eslint-disable jsx-a11y/no-autofocus */
/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApolloError, useApolloClient } from '@apollo/client';
import {
	Button,
	Container,
	Input,
	Padding,
	Row,
	Text,
	Tooltip
} from '@zextras/carbonio-design-system';
import debounce from 'lodash/debounce';
import findIndex from 'lodash/findIndex';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import some from 'lodash/some';
import trim from 'lodash/trim';
import { useTranslation } from 'react-i18next';

import { DOUBLE_CLICK_DELAY } from '../../constants';
import { NodeAvatarIconContext } from '../../contexts';
import BASE_NODE from '../../graphql/fragments/baseNode.graphql';
import CHILD from '../../graphql/fragments/child.graphql';
import GET_BASE_NODE from '../../graphql/queries/getBaseNode.graphql';
import { useCreateFolderMutation } from '../../hooks/graphql/mutations/useCreateFolderMutation';
import { useGetChildrenQuery } from '../../hooks/graphql/queries/useGetChildrenQuery';
import { useGetPermissionsQuery } from '../../hooks/graphql/queries/useGetPermissionsQuery';
import { useGetRootsListQuery } from '../../hooks/graphql/queries/useGetRootsListQuery';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { NodeListItemType, NodeWithMetadata, RootListItemType } from '../../types/common';
import {
	ChildFragment,
	GetBaseNodeQuery,
	GetBaseNodeQueryVariables
} from '../../types/graphql/types';
import { ArrayOneOrMore } from '../../types/utils';
import { canCreateFolder, isFile, isFolder } from '../../utils/ActionsFactory';
import { decodeError } from '../../utils/utils';
import { LoadingIcon } from './LoadingIcon';
import { ModalFooter } from './ModalFooter';
import { ModalHeader } from './ModalHeader';
import { ModalList } from './ModalList';
import { ModalRootsList } from './ModalRootsList';
import { FlexContainer } from './StyledComponents';

interface NodesSelectionModalContentProps {
	title: string;
	confirmAction: (nodes: ArrayOneOrMore<NodeWithMetadata>) => void;
	confirmLabel: string;
	closeAction: () => void;
	isValidSelection?: (node: NodeWithMetadata | RootListItemType) => boolean;
	maxSelection?: number;
	disabledTooltip?: string;
	canSelectOpenedFolder?: boolean;
	description?: string;
	canCreateFolder?: boolean;
}

const stopPropagation = (e: Event | React.SyntheticEvent): void => {
	e.stopPropagation();
};

export const NodesSelectionModalContent: React.VFC<NodesSelectionModalContentProps> = ({
	title,
	confirmAction,
	confirmLabel,
	closeAction,
	isValidSelection = (): boolean => true, // by default all nodes are active,
	maxSelection,
	disabledTooltip,
	canSelectOpenedFolder,
	description,
	canCreateFolder: canCreateFolderProp
}) => {
	const [t] = useTranslation();
	const apolloClient = useApolloClient();
	const [openedFolder, setOpenedFolder] = useState<string>('');
	const mainContainerRef = useRef<HTMLDivElement | null>(null);
	const [selectedNodes, setSelectedNodes] = useState<NodeWithMetadata[]>([]);
	const selectedNodesIds = useMemo(() => map(selectedNodes, (node) => node.id), [selectedNodes]);
	const navigationOccurredRef = useRef(false);
	const [newFolderInputVisible, setNewFolderInputVisible] = useState(false);
	const [newFolderName, setNewFolderName] = useState('');
	const newFolderInputRef = useRef<HTMLInputElement>(null);

	const { data: currentFolder, loading, hasMore, loadMore } = useGetChildrenQuery(openedFolder);

	const { data: currentFolderPermissions } = useGetPermissionsQuery(openedFolder);

	const currentFolderNode = useMemo(
		() =>
			(currentFolder?.getNode && isFolder(currentFolder.getNode) && currentFolder.getNode) || null,
		[currentFolder?.getNode]
	);

	const selectId = useCallback(
		(node: NodeWithMetadata) => {
			setSelectedNodes((prevState) => {
				if (!maxSelection || maxSelection > 1) {
					if (prevState.length === 1) {
						// if previous selected node is the opened folder and user is selecting a node from the list,
						// reset the selection to contains only the list node
						if (prevState[0].id === currentFolderNode?.id && node.id !== currentFolderNode?.id) {
							return [node];
						}
						// if previous selected node is the one to deselect and opened folder is a potentially valid selection,
						// try to set opened folder as selected node
						if (prevState[0].id === node.id && canSelectOpenedFolder && currentFolderNode) {
							// current folder base node has to be already in cache because of previous navigation
							// so read data directly from cache
							const cachedNode = apolloClient.readFragment({
								fragment: BASE_NODE,
								fragmentName: 'BaseNode',
								id: apolloClient.cache.identify(currentFolderNode)
							});
							return cachedNode ? [cachedNode] : [];
						}
					}
					const newSelection = [...prevState];
					const index = findIndex(newSelection, (prevNode) => prevNode.id === node.id);
					if (index > -1) {
						newSelection.splice(index, 1);
					} else {
						newSelection.push(node);
					}
					return newSelection;
				}
				return [node];
			});
		},
		[apolloClient, canSelectOpenedFolder, currentFolderNode, maxSelection]
	);

	const unSelectAll = useCallback(() => {
		setSelectedNodes((prevState) => (prevState.length > 0 ? [] : prevState));
	}, []);

	const [error, setError] = useState<ApolloError | undefined>();
	// load roots data to check whether a node from root list is a valid root or a fake one
	const { data: rootsData } = useGetRootsListQuery();

	useErrorHandler(error, 'NODES_SELECTION_MODAL_CONTENT');

	useEffect(() => {
		if (newFolderInputVisible && newFolderInputRef.current) {
			newFolderInputRef.current.focus();
		}
	}, [newFolderInputVisible]);

	const showCreateFolderInput = useCallback(
		(e: React.SyntheticEvent | Event) => {
			stopPropagation(e);
			setNewFolderInputVisible(true);
			unSelectAll();
		},
		[unSelectAll]
	);

	const hideCreateFolderInput = useCallback(() => {
		setNewFolderInputVisible(false);
		setNewFolderName('');
	}, []);

	const hideCreateFolderInputDebounced = useMemo(
		() => debounce(hideCreateFolderInput, DOUBLE_CLICK_DELAY, { leading: false, trailing: true }),
		[hideCreateFolderInput]
	);

	const checkSelectable = useCallback(
		(node: NodeWithMetadata | RootListItemType) =>
			// folders and roots are never disabled since they must be navigable
			isValidSelection(node),
		[isValidSelection]
	);

	const checkDisabled = useCallback(
		(node: NodeWithMetadata | RootListItemType) =>
			// folders and roots are never disabled since they must be navigable
			isFile(node) && !checkSelectable(node),
		[checkSelectable]
	);

	const nodes = useMemo<Array<NodeListItemType>>(() => {
		if (currentFolderNode?.children && currentFolderNode.children.length > 0) {
			return reduce<typeof currentFolderNode.children[number], NodeListItemType[]>(
				currentFolderNode.children,
				(result, node) => {
					if (node) {
						result.push({
							...node,
							disabled: checkDisabled(node),
							selectable: checkSelectable(node)
						});
					}
					return result;
				},
				[]
			);
		}
		return [];
	}, [checkDisabled, checkSelectable, currentFolderNode]);

	const getBaseNodeData = useCallback(
		(node: Pick<NodeListItemType, 'id'>) =>
			// for nodes already loaded as child these query should read data in cache
			apolloClient.query<GetBaseNodeQuery, GetBaseNodeQueryVariables>({
				query: GET_BASE_NODE,
				variables: {
					node_id: node.id
				}
			}),
		[apolloClient]
	);

	const setSelectedNodeHandler = useCallback(
		(
			node: Pick<NodeListItemType | RootListItemType, 'id' | '__typename'> | null | undefined,
			event?: React.SyntheticEvent,
			reset?: boolean
		) => {
			/**
			 * Internal util function to set state
			 */
			const setSelectedNodeIfValid = (
				nodeWithMetadata: NodeWithMetadata | null | undefined
			): void => {
				// if is a node already loaded
				if (
					nodeWithMetadata &&
					isValidSelection(nodeWithMetadata) &&
					(canSelectOpenedFolder || nodeWithMetadata.id !== currentFolderNode?.id)
				) {
					event && event.stopPropagation();
					// if is valid set it directly
					selectId(nodeWithMetadata);
					// delay the hide callback of the input to make navigation to be executed before this one, in order
					// to avoid a resize of the modal height on double click, which could lead to double-click on the wrong item
					// (flick is caused by the input change state from visible to hidden)
					hideCreateFolderInputDebounced();
				}
			};

			navigationOccurredRef.current = false;
			if (reset) {
				unSelectAll();
			}
			const cachedNode = node?.id
				? apolloClient.readFragment<ChildFragment>({
						fragment: CHILD,
						fragmentName: 'Child',
						// assuming it's a folder, not the best solution
						id: apolloClient.cache.identify(node)
				  })
				: null;
			if (cachedNode?.id) {
				// set directly cached data to make operation immediate
				setSelectedNodeIfValid(cachedNode);
			} else if (node?.id && some(rootsData?.getRootsList, (root) => root?.id === node.id)) {
				// if node is a Root load data in order to check its validity
				getBaseNodeData(node)
					.then((result) => {
						// avoid to set active node if navigation occurred while query was executing
						if (!navigationOccurredRef.current) {
							setSelectedNodeIfValid(result?.data.getNode);
						}
					})
					.catch((err) => {
						setError(err);
					});
			}
		},
		[
			apolloClient,
			canSelectOpenedFolder,
			currentFolderNode?.id,
			getBaseNodeData,
			hideCreateFolderInputDebounced,
			isValidSelection,
			rootsData?.getRootsList,
			selectId,
			unSelectAll
		]
	);

	const navigateTo = useCallback(
		(id: string) => {
			setOpenedFolder(id || '');
			hideCreateFolderInputDebounced.cancel();
			hideCreateFolderInput();
			navigationOccurredRef.current = true;
			if (canSelectOpenedFolder && id) {
				setSelectedNodeHandler({ id, __typename: 'Folder' }, undefined, true);
			} else {
				unSelectAll();
			}
		},
		[
			canSelectOpenedFolder,
			hideCreateFolderInput,
			hideCreateFolderInputDebounced,
			setSelectedNodeHandler,
			unSelectAll
		]
	);

	const closeHandler = useCallback(() => {
		setSelectedNodeHandler(undefined);
		closeAction();
	}, [closeAction, setSelectedNodeHandler]);

	const confirmHandler = useCallback(() => {
		// read all nodes from cache
		if (selectedNodes.length > 0) {
			confirmAction(selectedNodes as ArrayOneOrMore<NodeWithMetadata>);
			closeAction();
		}
	}, [closeAction, confirmAction, selectedNodes]);

	const confirmDisabled = useMemo(
		() => selectedNodes.length < 1 || (!!maxSelection && selectedNodes.length > maxSelection),
		[maxSelection, selectedNodes.length]
	);

	const resetSelectedNodesHandler = useCallback(() => {
		if (maxSelection === 1 || selectedNodes.length === 0) {
			if (canSelectOpenedFolder) {
				setSelectedNodeHandler(currentFolderNode, undefined, true);
			} else if (selectedNodes.length > 0) {
				unSelectAll();
			}
		}
	}, [
		canSelectOpenedFolder,
		currentFolderNode,
		maxSelection,
		selectedNodes.length,
		setSelectedNodeHandler,
		unSelectAll
	]);

	const clickModalHandler = useCallback(
		(event) => {
			if (event.target === mainContainerRef.current?.parentElement) {
				resetSelectedNodesHandler();
			}
		},
		[resetSelectedNodesHandler]
	);

	useEffect(() => {
		// since with modal manager we have not control on modal container, set the reset action through the main container parent
		// it's quite an ugly solution, let's say it's a TODO: find a better solution
		const containerParentElement = mainContainerRef?.current?.parentElement;
		containerParentElement && containerParentElement.addEventListener('click', clickModalHandler);

		return (): void => {
			containerParentElement &&
				containerParentElement.removeEventListener('click', clickModalHandler);
		};
	}, [clickModalHandler]);

	const {
		createFolder,
		loading: createFolderPendingRequest,
		error: createFolderError,
		reset: resetCreateFolderError
	} = useCreateFolderMutation({ showSnackbar: false });

	const createFolderHandler = useCallback(
		(e: Event | React.SyntheticEvent) => {
			stopPropagation(e);
			// create folder and add it to the list
			if (!createFolderPendingRequest && currentFolderNode && newFolderName) {
				createFolder(currentFolderNode, newFolderName)
					.then((result) => {
						result.data && setSelectedNodeHandler(result.data.createFolder);
						hideCreateFolderInput();
					})
					.catch((err) => {
						setError(err);
					});
			}
		},
		[
			createFolder,
			createFolderPendingRequest,
			currentFolderNode,
			hideCreateFolderInput,
			newFolderName,
			setSelectedNodeHandler
		]
	);

	const onNewFolderInputChange = useCallback(
		({ target: { value } }) => {
			if (!createFolderPendingRequest) {
				if (trim(value).length === 0) {
					setNewFolderName('');
				} else {
					setNewFolderName(value);
				}
				if (createFolderError) {
					resetCreateFolderError();
				}
			}
		},
		[createFolderError, createFolderPendingRequest, resetCreateFolderError]
	);

	const newFolderButtonDisabled = useMemo(
		() =>
			!currentFolderNode ||
			!currentFolderPermissions?.getNode ||
			!canCreateFolder(currentFolderPermissions.getNode),
		[currentFolderNode, currentFolderPermissions?.getNode]
	);

	return (
		<Container
			padding={{ all: 'large' }}
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			minHeight="40vh"
			height="auto"
			maxHeight="60vh"
			onClick={resetSelectedNodesHandler}
			ref={mainContainerRef}
		>
			<ModalHeader title={title} closeHandler={closeHandler} />
			<Container
				padding={{ vertical: 'small' }}
				mainAlignment="center"
				crossAlignment="flex-start"
				height="fit"
			>
				<Text overflow="break-word" size="small">
					{description}
				</Text>
			</Container>
			<NodeAvatarIconContext.Provider
				value={{
					tooltipLabel: disabledTooltip,
					tooltipDisabled: ({ selectable }): boolean => selectable
				}}
			>
				{currentFolderNode ? (
					<ModalList
						folderId={currentFolderNode.id}
						nodes={nodes}
						activeNodes={selectedNodesIds}
						setActiveNode={setSelectedNodeHandler}
						loadMore={loadMore}
						hasMore={hasMore}
						navigateTo={navigateTo}
						loading={loading}
						limitNavigation={false}
						allowRootNavigation
					/>
				) : (
					(!loading && (
						<ModalRootsList
							activeNodes={selectedNodesIds}
							setActiveNode={setSelectedNodeHandler}
							navigateTo={navigateTo}
							checkDisabled={checkDisabled}
							checkSelectable={checkSelectable}
							showTrash={false}
						/>
					)) || (
						<FlexContainer
							mainAlignment="flex-end"
							crossAlignment="flex-start"
							orientation="horizontal"
							$flexGrow={1}
							$flexBasis="100%"
						>
							<LoadingIcon icon="Refresh" color="primary" />
						</FlexContainer>
					)
				)}
			</NodeAvatarIconContext.Provider>
			<ModalFooter
				confirmLabel={confirmLabel}
				confirmHandler={confirmHandler}
				confirmDisabled={confirmDisabled}
			>
				{!newFolderInputVisible && (
					<>
						{(!maxSelection || maxSelection > 1) && selectedNodes.length > 0 && (
							<Container
								mainAlignment="flex-start"
								crossAlignment="center"
								orientation="horizontal"
							>
								<Text size="small" weight="light">
									{t('modal.nodesSelection.selectedCount', {
										defaultValue:
											selectedNodes.length === 1
												? '{{count}} element selected'
												: '{{count}} elements selected',
										count: selectedNodes.length
									})}
								</Text>
							</Container>
						)}
						{canCreateFolderProp && openedFolder && (
							<Padding left="small">
								<Tooltip
									disabled={!newFolderButtonDisabled}
									label={t(
										'modal.nodeSelection.button.newFolder.disabled',
										"You don't have the correct permissions"
									)}
									placement="top"
								>
									<Button
										color="primary"
										type="outlined"
										onClick={showCreateFolderInput}
										label={t('modal.nodeSelection.button.newFolder.label', 'New folder')}
										disabled={newFolderButtonDisabled}
									/>
								</Tooltip>
							</Padding>
						)}
					</>
				)}
				{newFolderInputVisible && (
					<>
						<Container
							orientation="vertical"
							mainAlignment="flex-start"
							crossAlignment="flex-start"
							onClick={stopPropagation}
						>
							<Input
								value={newFolderName}
								onChange={onNewFolderInputChange}
								label={`${t('modal.nodeSelection.input.newFolder', "New folder's name")}*`}
								data-testid="input-name"
								onEnter={createFolderHandler}
								hasError={createFolderError !== undefined}
								backgroundColor="gray5"
								inputRef={newFolderInputRef}
							/>
							{createFolderError && (
								<Row padding={{ top: 'small' }}>
									<Text color="error" overflow="break-word" size="small">
										{decodeError(createFolderError, t)}
									</Text>
								</Row>
							)}
						</Container>
						<Padding left="small" top="small" onClick={stopPropagation}>
							<Button
								color="primary"
								type="outlined"
								onClick={createFolderHandler}
								label={t('modal.nodeSelection.button.create', 'Create')}
								disabled={newFolderName.length === 0 || createFolderPendingRequest}
							/>
						</Padding>
					</>
				)}
			</ModalFooter>
		</Container>
	);
};
