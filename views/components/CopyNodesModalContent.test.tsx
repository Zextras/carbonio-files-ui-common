/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, fireEvent, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import { NODES_LOAD_LIMIT, ROOTS } from '../../constants';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	populateFile,
	populateFolder,
	populateLocalRoot,
	populateNodePage,
	populateNodes,
	populateParents
} from '../../mocks/mockUtils';
import {
	Folder,
	File,
	Node,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockCopyNodes,
	mockFindNodes,
	mockGetChildren,
	mockGetPath
} from '../../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	render,
	selectNodes,
	triggerLoadMore
} from '../../utils/testUtils';
import { CopyNodesModalContent } from './CopyNodesModalContent';

describe('Copy Nodes Modal', () => {
	test('if a folder id is provided, list shows content of the folder', async () => {
		const currentFolder = populateFolder(5);
		const nodesToCopy = [currentFolder.children.nodes[0] as File | Folder];
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];
		render(<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />, {
			mocks
		});
		await screen.findByText((currentFolder.children.nodes[0] as File | Folder).name);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length
		);
	});

	test('if a folder id is not provided and only one node is going to be copied, list shows content of parent of the node', async () => {
		const parentFolder = populateFolder(5);
		const nodesToCopy = [parentFolder.children.nodes[0] as File | Folder];
		const mocks = [
			mockGetPath({ node_id: parentFolder.id }, [parentFolder]),
			mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder)
		];
		render(<CopyNodesModalContent nodesToCopy={nodesToCopy} />, { mocks });
		await screen.findByText((parentFolder.children.nodes[0] as File | Folder).name);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			parentFolder.children.nodes.length
		);
	});

	test('if a folder id is not provided and multiple nodes with same parent are going to be copied, list shows content of parent of the nodes', async () => {
		const parentFolder = populateFolder(5);
		const nodesToCopy = [
			parentFolder.children.nodes[0] as File | Folder,
			parentFolder.children.nodes[1] as File | Folder
		];
		const mocks = [
			mockGetPath({ node_id: parentFolder.id }, [parentFolder]),
			mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder)
		];
		const { findByTextWithMarkup } = render(<CopyNodesModalContent nodesToCopy={nodesToCopy} />, {
			mocks
		});
		await screen.findByText((parentFolder.children.nodes[0] as File | Folder).name);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			parentFolder.children.nodes.length
		);
		expect(screen.getByText(nodesToCopy[0].name)).toBeVisible();
		expect(screen.getByText(nodesToCopy[1].name)).toBeVisible();
		const breadcrumbRegexp = buildBreadCrumbRegExp('Files', parentFolder.name);
		const breadcrumb = await findByTextWithMarkup(breadcrumbRegexp);
		expect(breadcrumb).toBeVisible();
	});

	test('if a folder id is not provided and multiple nodes with different parents are going to be copied, list shows roots', async () => {
		const nodesToCopy = populateNodes(2);
		forEach(nodesToCopy, (mockedNode) => {
			mockedNode.parent = populateFolder();
		});
		const { findByTextWithMarkup } = render(<CopyNodesModalContent nodesToCopy={nodesToCopy} />, {
			mocks: []
		});
		await screen.findByText('Home');
		expect(screen.getByText('Home')).toBeVisible();
		expect(screen.getByText('Shared with me')).toBeVisible();
		expect(screen.queryByText('Trash')).not.toBeInTheDocument();

		expect(screen.queryByText(nodesToCopy[0].name)).not.toBeInTheDocument();
		expect(screen.queryByText(nodesToCopy[1].name)).not.toBeInTheDocument();
		const breadcrumbRegexp = buildBreadCrumbRegExp('Files');
		const breadcrumb = await findByTextWithMarkup(breadcrumbRegexp);
		expect(breadcrumb).toBeVisible();
	});

	test('folders without permission, nodes to copy and files are disabled in the list and not navigable', async () => {
		const currentFolder = populateFolder();
		const folderWithWriteFile = populateFolder(1);
		folderWithWriteFile.permissions.can_write_file = true;
		folderWithWriteFile.permissions.can_write_folder = false;
		currentFolder.children.nodes.push(folderWithWriteFile);
		const folderWithWriteFolder = populateFolder(1);
		folderWithWriteFolder.permissions.can_write_file = false;
		folderWithWriteFolder.permissions.can_write_folder = true;
		currentFolder.children.nodes.push(folderWithWriteFolder);
		const file = populateFile();
		file.permissions.can_write_file = true;
		currentFolder.children.nodes.push(file);
		const folder = populateFolder();
		folder.permissions.can_write_folder = true;
		folder.permissions.can_write_file = true;
		currentFolder.children.nodes.push(folder);

		// first copy file -> folderWithWriteFolder is disabled
		let nodesToCopy: Array<File | Folder> = [file];
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPath({ node_id: folderWithWriteFile.id }, [currentFolder, folderWithWriteFile]),
			mockGetChildren(getChildrenVariables(folderWithWriteFile.id), folderWithWriteFile),
			mockGetPath({ node_id: folderWithWriteFolder.id }, [currentFolder, folderWithWriteFolder]),
			mockGetChildren(getChildrenVariables(folderWithWriteFolder.id), folderWithWriteFolder)
		];
		const { rerender } = render(
			<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />,
			{ mocks }
		);
		await screen.findByText((currentFolder.children.nodes[0] as File | Folder).name);
		let folderWithWriteFolderItem = screen.getByText(folderWithWriteFolder.name);
		let folderWithWriteFileItem = screen.getByText(folderWithWriteFile.name);
		let fileItem = screen.getByText(file.name);
		let folderItem = screen.getByText(folder.name);
		// folder without write file permission is disabled and not navigable
		expect(folderWithWriteFolderItem).toHaveAttribute('disabled');
		// double click on a disabled folder does nothing
		userEvent.dblClick(folderWithWriteFolderItem);
		expect(folderWithWriteFolderItem).toBeVisible();
		expect(folderWithWriteFolderItem).toHaveAttribute('disabled');
		// folder is active
		expect(folderItem).not.toHaveAttribute('disabled');
		// file is disabled
		expect(fileItem).toHaveAttribute('disabled');
		// folder with write file permission is active and navigable
		expect(folderWithWriteFileItem).toBeVisible();
		expect(folderWithWriteFileItem).not.toHaveAttribute('disabled');
		userEvent.dblClick(folderWithWriteFileItem);
		// navigate to sub-folder
		await screen.findByText((folderWithWriteFile.children.nodes[0] as File | Folder).name);
		expect(folderWithWriteFileItem).not.toBeInTheDocument();

		// then copy folder
		nodesToCopy = [folder];
		rerender(<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />);
		await screen.findByText((currentFolder.children.nodes[0] as File | Folder).name);
		folderWithWriteFolderItem = screen.getByText(folderWithWriteFolder.name);
		folderWithWriteFileItem = screen.getByText(folderWithWriteFile.name);
		fileItem = screen.getByText(file.name);
		folderItem = screen.getByText(folder.name);
		// folder without write folder permission is disabled and not navigable
		expect(folderWithWriteFileItem).toHaveAttribute('disabled');
		// double click on a disabled folder does nothing
		userEvent.dblClick(folderWithWriteFileItem);
		await waitFor(() => expect(folderWithWriteFileItem).toBeVisible());
		expect(folderWithWriteFileItem).toHaveAttribute('disabled');
		// moving folder is disabled
		expect(folderItem).toHaveAttribute('disabled');
		// file is disabled
		expect(fileItem).toHaveAttribute('disabled');
		// folder with write folder permission is active and navigable
		expect(folderWithWriteFolderItem).toBeVisible();
		expect(folderWithWriteFolderItem).not.toHaveAttribute('disabled');
		userEvent.dblClick(folderWithWriteFolderItem);
		// navigate to sub-folder
		await screen.findByText((folderWithWriteFolder.children.nodes[0] as File | Folder).name);
		expect(folderWithWriteFolderItem).not.toBeInTheDocument();
	});

	test('roots are navigable, only local root is selectable', async () => {
		const nodesToCopy = populateNodes(2);
		const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT, 'Home');
		const sharedWithMeFilter = populateNodes(3, 'Folder');
		sharedWithMeFilter[0].permissions.can_write_folder = true;
		sharedWithMeFilter[0].permissions.can_write_file = true;
		forEach(nodesToCopy, (mockedNode) => {
			mockedNode.parent = populateFolder();
		});
		const mocks = [
			mockGetPath({ node_id: localRoot.id }, [localRoot]),
			mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
			mockFindNodes(
				getFindNodesVariables({
					shared_with_me: true,
					folder_id: ROOTS.LOCAL_ROOT,
					cascade: false
				}),
				sharedWithMeFilter
			),
			mockGetPath({ node_id: sharedWithMeFilter[0].id }, [sharedWithMeFilter[0]]),
			mockGetChildren(getChildrenVariables(sharedWithMeFilter[0].id), sharedWithMeFilter[0])
		];
		const { findByTextWithMarkup, getByTextWithMarkup } = render(
			<CopyNodesModalContent nodesToCopy={nodesToCopy} />,
			{
				mocks
			}
		);
		const filesHome = await screen.findByText('Home');
		userEvent.click(filesHome);
		expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute('disabled');
		// navigate inside local root
		userEvent.dblClick(filesHome);
		await screen.findByText((localRoot.children.nodes[0] as Node).name);
		expect(screen.getByText((localRoot.children.nodes[0] as Node).name)).toBeVisible();
		expect(screen.getByText((localRoot.children.nodes[1] as Node).name)).toBeVisible();
		let breadcrumb = await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
		expect(breadcrumb).toBeVisible();
		expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute('disabled');

		// go back to roots list
		userEvent.click(screen.getByText('Files'));
		await screen.findByText('Home');
		const sharedWithMeItem = await screen.findByText('Shared with me');
		breadcrumb = await findByTextWithMarkup(buildBreadCrumbRegExp('Files'));
		expect(breadcrumb).toBeVisible();
		userEvent.click(sharedWithMeItem);
		expect(screen.getByRole('button', { name: actionRegexp.copy })).toHaveAttribute('disabled');

		// navigate inside shared with me filter
		userEvent.dblClick(sharedWithMeItem);
		await screen.findByText(sharedWithMeFilter[0].name);
		// full breadcrumb is visible
		expect(screen.getByText(sharedWithMeFilter[0].name)).toBeVisible();
		expect(screen.getByText(sharedWithMeFilter[1].name)).toBeVisible();
		expect(screen.getByText(sharedWithMeFilter[2].name)).toBeVisible();
		breadcrumb = await findByTextWithMarkup(buildBreadCrumbRegExp('Files', 'Shared with me'));
		expect(breadcrumb).toBeVisible();
		expect(screen.getByRole('button', { name: actionRegexp.copy })).toHaveAttribute('disabled');
		// select destination folder from filter
		userEvent.click(screen.getByText(sharedWithMeFilter[0].name));
		await waitFor(() =>
			expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
				'disabled'
			)
		);
		// reset active node by clicking on modal title
		userEvent.click(screen.getByText('Copy items'));
		await waitFor(() =>
			expect(screen.getByRole('button', { name: actionRegexp.copy })).toHaveAttribute('disabled')
		);

		// navigate inside folder of shared with me filter
		userEvent.dblClick(screen.getByText(sharedWithMeFilter[0].name));
		await screen.findByText(/It looks like there's nothing here./);
		// breadcrumb is updated
		expect(
			getByTextWithMarkup(buildBreadCrumbRegExp('Files', sharedWithMeFilter[0].name))
		).toBeVisible();
		expect(screen.queryByText(sharedWithMeFilter[1].name)).not.toBeInTheDocument();
		expect(screen.queryByText(sharedWithMeFilter[2].name)).not.toBeInTheDocument();
		breadcrumb = await findByTextWithMarkup(
			buildBreadCrumbRegExp('Files', sharedWithMeFilter[0].name)
		);
		expect(breadcrumb).toBeVisible();
		expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute('disabled');
	});

	test('node actions are not shown', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		const folder = populateFolder();
		folder.permissions.can_write_file = true;
		folder.flagged = false;
		currentFolder.children.nodes.push(file, folder);

		const nodesToCopy = [file];
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];
		render(<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />, {
			mocks
		});
		const folderItem = await screen.findByText(folder.name);
		// context menu
		fireEvent.contextMenu(folderItem);
		// wait a tick to be sure eventual context menu has time to open
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		expect(screen.queryByText(actionRegexp.flag)).not.toBeInTheDocument();
		// hover bar
		expect(screen.queryByTestId('icon: FlagOutline')).not.toBeInTheDocument();
		// selection mode
		selectNodes([folder.id]);
		// wait a tick to be sure eventual selection icon is shown
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
	});

	test('confirm action without selecting a destination copy node in opened folder. Confirm button is active if destination folder matches origin folder', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		file.permissions.can_write_file = true;
		file.parent = currentFolder;
		currentFolder.children.nodes.push(file);
		const folder = populateFolder(0);
		folder.permissions.can_write_folder = true;
		folder.permissions.can_write_file = true;
		folder.parent = currentFolder;
		currentFolder.children.nodes.push(folder);

		const nodesToCopy = [file];
		const copiedNodes = map(nodesToCopy, (node) => ({
			...node,
			parent: folder,
			id: `new-id-${node.id}`
		}));
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockCopyNodes(
				{ node_ids: map(nodesToCopy, (node) => node.id), destination_id: currentFolder.id },
				copiedNodes
			),
			mockGetChildren(getChildrenVariables(currentFolder.id), {
				...currentFolder,
				children: populateNodePage([...currentFolder.children.nodes, ...copiedNodes])
			} as Folder)
		];

		const closeAction = jest.fn();

		render(
			<CopyNodesModalContent
				folderId={currentFolder.id}
				nodesToCopy={nodesToCopy}
				closeAction={closeAction}
			/>,
			{ mocks }
		);

		await screen.findByText(folder.name);
		const confirmButton = screen.getByRole('button', { name: actionRegexp.copy });
		expect(confirmButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(confirmButton);
		});
		await waitFor(() => expect(closeAction).toHaveBeenCalled());
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		const currentFolderCachedData = global.apolloClient.readQuery<
			GetChildrenQuery,
			GetChildrenQueryVariables
		>(mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder).request);
		expect(
			(currentFolderCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
		).toHaveLength(currentFolder.children.nodes.length + nodesToCopy.length);
	});

	test('confirm action without selecting a destination copy node in opened sub-folder', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		file.permissions.can_write_file = true;
		file.parent = currentFolder;
		currentFolder.children.nodes.push(file);
		const folder = populateFolder(0);
		folder.permissions.can_write_folder = true;
		folder.permissions.can_write_file = true;
		folder.parent = currentFolder;
		currentFolder.children.nodes.push(folder);

		const nodesToCopy = [file];
		const copiedNodes = map(nodesToCopy, (node) => ({
			...node,
			parent: folder,
			id: `new-id-${node.id}`
		}));
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPath({ node_id: folder.id }, [currentFolder, folder]),
			mockGetChildren(getChildrenVariables(folder.id), folder),
			mockCopyNodes(
				{ node_ids: map(nodesToCopy, (node) => node.id), destination_id: folder.id },
				copiedNodes
			),
			mockGetChildren(getChildrenVariables(folder.id), {
				...folder,
				children: populateNodePage(copiedNodes)
			} as Folder)
		];

		const closeAction = jest.fn();

		render(
			<CopyNodesModalContent
				folderId={currentFolder.id}
				nodesToCopy={nodesToCopy}
				closeAction={closeAction}
			/>,
			{ mocks }
		);

		const folderItem = await screen.findByText(folder.name);
		const confirmButton = screen.getByRole('button', { name: actionRegexp.copy });
		expect(confirmButton).not.toHaveAttribute('disabled');
		userEvent.click(folderItem);
		expect(confirmButton).not.toHaveAttribute('disabled');
		userEvent.dblClick(folderItem);
		await screen.findByText(/It looks like there's nothing here./i);
		expect(confirmButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(confirmButton);
		});
		await waitFor(() => expect(closeAction).toHaveBeenCalled());
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		const currentFolderCachedData = global.apolloClient.readQuery<
			GetChildrenQuery,
			GetChildrenQueryVariables
		>(mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder).request);
		expect(
			(currentFolderCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
		).toHaveLength(currentFolder.children.nodes.length);
		const folderCachedData = global.apolloClient.readQuery<
			GetChildrenQuery,
			GetChildrenQueryVariables
		>(mockGetChildren(getChildrenVariables(folder.id), folder).request);
		expect(
			(folderCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
		).toHaveLength(nodesToCopy.length);
	});

	test('confirm action after selecting a destination from the list copy node in selected destination', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		file.permissions.can_write_file = true;
		file.parent = currentFolder;
		currentFolder.children.nodes.push(file);
		const folder = populateFolder(0);
		folder.permissions.can_write_folder = true;
		folder.permissions.can_write_file = true;
		folder.parent = currentFolder;
		currentFolder.children.nodes.push(folder);

		const nodesToCopy = [file];
		const copiedNodes = map(nodesToCopy, (node) => ({
			...node,
			parent: folder,
			id: `new-id-${node.id}`
		}));
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockCopyNodes(
				{ node_ids: map(nodesToCopy, (node) => node.id), destination_id: folder.id },
				copiedNodes
			),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const closeAction = jest.fn();

		render(
			<CopyNodesModalContent
				folderId={currentFolder.id}
				nodesToCopy={nodesToCopy}
				closeAction={closeAction}
			/>,
			{ mocks }
		);

		const folderItem = await screen.findByText(folder.name);
		const confirmButton = screen.getByRole('button', { name: actionRegexp.copy });
		userEvent.click(folderItem);
		expect(confirmButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(confirmButton);
		});
		await waitFor(() => expect(closeAction).toHaveBeenCalled());
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		await waitFor(() => {
			const currentFolderCachedData = global.apolloClient.readQuery<
				GetChildrenQuery,
				GetChildrenQueryVariables
			>(mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder).request);
			expect(
				(currentFolderCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
			).toHaveLength(currentFolder.children.nodes.length);
		});
		const folderCachedData = global.apolloClient.readQuery<
			GetChildrenQuery,
			GetChildrenQueryVariables
		>(mockGetChildren(getChildrenVariables(folder.id), folder).request);
		expect(folderCachedData).toBeNull();
	});

	test('confirm action on local root from root list copy nodes in local root (local root is cached)', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		file.permissions.can_write_file = true;
		file.parent = currentFolder;
		currentFolder.children.nodes.push(file);
		const localRoot = populateLocalRoot(2);
		localRoot.permissions.can_write_folder = true;
		localRoot.permissions.can_write_file = true;

		const nodesToCopy = [file];
		const copiedNodes = map(nodesToCopy, (node) => ({
			...node,
			parent: localRoot,
			id: `new-id-${node.id}`
		}));
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockCopyNodes(
				{ node_ids: map(nodesToCopy, (node) => node.id), destination_id: localRoot.id },
				copiedNodes
			),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const closeAction = jest.fn();

		global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(localRoot.id),
			data: {
				getNode: {
					...localRoot
				}
			}
		});

		const { findByTextWithMarkup } = render(
			<CopyNodesModalContent
				folderId={currentFolder.id}
				nodesToCopy={nodesToCopy}
				closeAction={closeAction}
			/>,
			{ mocks }
		);

		await screen.findByText(nodesToCopy[0].name);
		await findByTextWithMarkup(buildBreadCrumbRegExp('Files', currentFolder.name));
		const mockedGetChildrenQuery = mockGetChildren(getChildrenVariables(localRoot.id), localRoot);
		let cachedData = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>(
			mockedGetChildrenQuery.request
		);
		expect((cachedData?.getNode as Folder).children.nodes).toHaveLength(
			localRoot.children.nodes.length
		);
		userEvent.click(screen.getByText('Files'));
		await screen.findByText('Home');
		expect(screen.getByText('Home')).toBeVisible();
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		const confirmButton = screen.getByRole('button', { name: actionRegexp.copy });
		expect(confirmButton).toHaveAttribute('disabled');
		act(() => {
			userEvent.hover(confirmButton, undefined);
		});
		await screen.findByText(/you can't perform this action here/i);
		expect(screen.getByText(/you can't perform this action here/i)).toBeVisible();
		act(() => {
			userEvent.unhover(confirmButton);
		});
		expect(screen.queryByText(/you can't perform this action here/i)).not.toBeInTheDocument();
		userEvent.click(screen.getByText('Home'));
		expect(confirmButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.hover(confirmButton);
		});
		expect(screen.queryByText(/you can't perform this action here/i)).not.toBeInTheDocument();
		act(() => {
			userEvent.click(confirmButton);
		});
		await waitFor(() => expect(closeAction).toHaveBeenCalled());
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		expect(closeAction).toHaveBeenCalledTimes(1);
		cachedData = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>(
			mockedGetChildrenQuery.request
		);
		expect(cachedData).toBeNull();
	});

	test('confirm action on local root from root list copy nodes in local root (local root is not cached)', async () => {
		const currentFolder = populateFolder();
		const file = populateFile();
		file.permissions.can_write_file = true;
		file.parent = currentFolder;
		currentFolder.children.nodes.push(file);
		const localRoot = populateLocalRoot(2);
		localRoot.permissions.can_write_folder = true;
		localRoot.permissions.can_write_file = true;

		const nodesToCopy = [file];
		const copiedNodes = map(nodesToCopy, (node) => ({
			...node,
			parent: localRoot,
			id: `new-id-${node.id}`
		}));
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockCopyNodes(
				{ node_ids: map(nodesToCopy, (node) => node.id), destination_id: localRoot.id },
				copiedNodes
			),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const closeAction = jest.fn();

		const { findByTextWithMarkup } = render(
			<CopyNodesModalContent
				folderId={currentFolder.id}
				nodesToCopy={nodesToCopy}
				closeAction={closeAction}
			/>,
			{ mocks }
		);

		await screen.findByText(nodesToCopy[0].name);
		await findByTextWithMarkup(buildBreadCrumbRegExp('Files', currentFolder.name));
		userEvent.click(screen.getByText('Files'));
		await screen.findByText('Home');
		expect(screen.getByText('Home')).toBeVisible();
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		const confirmButton = screen.getByRole('button', { name: actionRegexp.copy });
		expect(confirmButton).toHaveAttribute('disabled');
		userEvent.click(screen.getByText('Home'));
		expect(confirmButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(confirmButton);
		});
		await waitFor(() => expect(closeAction).toHaveBeenCalled());
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		expect(closeAction).toHaveBeenCalledTimes(1);
	});

	test('breadcrumb shows full path of opened folder and allows navigation to parent nodes', async () => {
		const currentFolder = populateFolder();
		const { path } = populateParents(currentFolder, 4, true);
		forEach(path, (mockedNode) => {
			mockedNode.permissions.can_write_file = true;
		});
		const file = populateFile();
		const folder = populateFolder();
		folder.parent = currentFolder;
		folder.permissions.can_write_file = true;
		currentFolder.children.nodes.push(file, folder);
		const nodesToCopy = [file];
		const ancestorIndex = 1;
		const ancestor = path[ancestorIndex] as Folder;
		ancestor.children.nodes = [path[ancestorIndex + 1]];
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, path),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPath({ node_id: folder.id }, path.concat(folder)),
			mockGetChildren(getChildrenVariables(folder.id), folder),
			mockGetPath({ node_id: ancestor.id }, path.slice(0, ancestorIndex + 1)),
			mockGetChildren(getChildrenVariables(ancestor.id), ancestor)
		];

		const { getByTextWithMarkup, findByTextWithMarkup } = render(
			<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />,
			{ mocks }
		);

		let breadcrumbRegexp = buildBreadCrumbRegExp('Files', ...map(path, (node) => node.name));
		await findByTextWithMarkup(breadcrumbRegexp);
		// full path immediately visible
		expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();
		// navigate to sub-folder
		userEvent.dblClick(screen.getByText(folder.name));
		breadcrumbRegexp = buildBreadCrumbRegExp(
			'Files',
			...map([...path, folder], (node) => node.name)
		);
		await findByTextWithMarkup(breadcrumbRegexp);
		expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();
		// navigate to ancestor
		userEvent.click(screen.getByText(ancestor.name));
		// wait children to be loaded
		breadcrumbRegexp = buildBreadCrumbRegExp(
			'Files',
			...map(path.slice(0, ancestorIndex + 1), (node) => node.name)
		);
		await findByTextWithMarkup(breadcrumbRegexp);
		expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();
		expect(screen.queryByText(currentFolder.name, { exact: false })).not.toBeInTheDocument();
		expect.assertions(4);
	});

	test('scroll trigger pagination', async () => {
		const currentFolder = populateFolder(NODES_LOAD_LIMIT * 2 - 1);
		const nodesToCopy = [currentFolder.children.nodes[0] as File | Folder];
		const mocks = [
			mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
			mockGetChildren(getChildrenVariables(currentFolder.id), {
				...currentFolder,
				children: populateNodePage(currentFolder.children.nodes.slice(0, NODES_LOAD_LIMIT))
			} as Folder),
			mockGetChildren(
				getChildrenVariables(currentFolder.id, undefined, undefined, undefined, true),
				{
					...currentFolder,
					children: populateNodePage(currentFolder.children.nodes.slice(NODES_LOAD_LIMIT))
				} as Folder
			)
		];
		render(<CopyNodesModalContent folderId={currentFolder.id} nodesToCopy={nodesToCopy} />, {
			mocks
		});
		await screen.findByText((currentFolder.children.nodes[0] as File | Folder).name);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(NODES_LOAD_LIMIT);
		expect(screen.getByTestId('icon: Refresh')).toBeInTheDocument();
		expect(screen.getByTestId('icon: Refresh')).toBeVisible();
		await triggerLoadMore();
		await screen.findByText(
			(currentFolder.children.nodes[currentFolder.children.nodes.length - 1] as File | Folder).name
		);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(screen.queryByTestId('icon: Refresh')).not.toBeInTheDocument();
	});
});
