// ~~~~~ //
// init. //
// ~~~~~ //

var tree = null;
var currentWindowId = null;

Promise.all(
[
	browser.tabs.query({ currentWindow : true })
]).then(function(promises)
{
	var ffTabs = promises[0];
	currentWindowId = ffTabs[0].windowId;
	
	document.addEventListener("mouseup", event => outsideEndClick(event));
	document.addEventListener("contextmenu", event => event.preventDefault());

	tree = newTree(ffTabs);
});

// ~~~~~~~~~~~~ //
// ff listeners //
// ~~~~~~~~~~~~ //

browser.tabs.onActivated.addListener(function(activeInfo) 
{
	if (activeInfo.windowId != currentWindowId)
		return;
		
	tree.getTab(activeInfo.tabId).activate();
});

browser.tabs.onRemoved.addListener(function(tabId, closeInfo)
{
	if (closeInfo.windowId != currentWindowId)
		return;

	if (closeInfo.isWindowClosing)
		return;

	var removeTab = tree.getTab(tabId);
	removeTab && removeTab.remove();
});

browser.tabs.onDetached.addListener(function(tabId, detachInfo)
{
	if (detachInfo.oldWindowId != currentWindowId)
		return;

	tree.getTab(tabId).remove();
});

browser.tabs.onUpdated.addListener(function(tabId, changeInfo, ffTab)
{
	if (ffTab.windowId != currentWindowId)
		return;

	var updatedTab = tree.getTab(tabId);
	updatedTab && updatedTab.fill(changeInfo);
});

browser.tabs.onCreated.addListener(function(ffTab)
{
	if (ffTab.windowId != currentWindowId)
		return;

	tree.createTab(ffTab, ffTab.openerTabId);
});

// ~~~~~~~~~~~ //
// tree object //
// ~~~~~~~~~~~ //

function newTree(ffTabs)
{
	var newTreeObj =
	{
		tabs : new Map(),
		node : document.querySelector("#tabs"),
		idOrder : [],
		activeTabId : null,
		createTab(ffTab, droppingOnTabId = null)
		{
			var newTabObj = newTab(ffTab.id, this);
			newTabObj.fill(ffTab);
			this.tabs[ffTab.id] = newTabObj;

			if (ffTab.active)
				newTabObj.activate(ffTab.id);

			if (droppingOnTabId)
				newTabObj.drop(droppingOnTabId, "on");
			else
				this.firstChildren.append(newTabObj);
		},
		getTab(tabId)
		{ 
			return this.tabs[tabId];
		},
		save()
		{
			
		}
	}

	newTreeObj.firstChildren = newChildren(newTreeObj, null);
	ffTabs.forEach(ffTab => newTreeObj.createTab(ffTab));

	return newTreeObj;
}

// ~~~~~~~~~~ //
// tab object //
// ~~~~~~~~~~ //

function newTab(tabId, inTree)
{
	var newTabObj =
	{
		id : tabId,
		tree : inTree,
		node : newTabNode(),
		treeLevel : 0,
		parent: null,
		attributes : {},
		getAttribute(attribute)
		{
			return this.attributes[attribute];
		},
		hasAttribute(attribute)
		{
			return this.attributes.hasOwnProperty(attribute);
		},
		setAttribute(attribute, value = "")
		{
			this.node.setAttribute(attribute, value);
			this.attributes[attribute] = value;
		},
		removeAttribute(attribute)
		{
			this.node.removeAttribute(attribute);
			delete this.attributes[attribute];
		},
		setTreeLevel(newTreeLevel)
		{
			this.node.setAttribute("tree-level", newTreeLevel);
			this.treeLevel = newTreeLevel;
			this.children.getShallow().forEach(childTab => childTab.setTreeLevel(newTreeLevel + 1));
		},
		getSiblings()
		{
			return this.parent ? this.tree.getTab(this.parent).children : this.tree.firstChildren;
		},
		fill(ffTabInfo)
		{
			if (ffTabInfo.title)
				this.node.querySelector(".tab-title").textContent = ffTabInfo.title;
			
			if (ffTabInfo.discarded)
				this.setAttribute("discarded");
			else
				this.removeAttribute("discarded");
		
			if (ffTabInfo.status && ffTabInfo.status == "loading")
				this.setAttribute("loading");
			else
				this.removeAttribute("loading");

			if (ffTabInfo.favIconUrl)
			{
				var tester = new Image();
				tester.onload = () => this.node.querySelector(".tab-favicon > img").src = ffTabInfo.favIconUrl;
				tester.onerror = () => this.node.querySelector(".tab-favicon > img").src = "favicon_default.png";
				tester.src = ffTabInfo.favIconUrl;
			}
		},
		activate()
		{
			if (this.tree.activeTabId)
				this.tree.getTab(this.tree.activeTabId).deactivate();

			this.tree.activeTabId = this.id;
			this.setAttribute("active");
		},
		deactivate()
		{
			this.tree.activeTabId = null;
			this.removeAttribute("active");
		},
		drop(landingTabId, dropSwitch)
		{
			if (!landingTabId || landingTabId == this.id)
				return; // eRRoR

			if (["above", "on", "below"].indexOf(dropSwitch) == -1)			
				return; // eRRoR

			var landingTab = this.tree.getTab(landingTabId);

			// remove from old siblings
			this.getSiblings().remove(this, false);

			if (dropSwitch == "on") // add as child to end of other children
				landingTab.children.append(this);
			else // add to new siblings (before or after)
				landingTab.getSiblings().insert(this, landingTab.id, dropSwitch == "above");
		},
		remove()
		{
			this.getSiblings().remove(this, true);

			if (this.id == this.tree.activeTabId)
				this.deactivate();
			delete this.tree.tabs[this.id];
			
			this.children.getDeep().forEach(ancestorTab => 
			{
				if (ancestorTab.id == ancestorTab.tree.activeTabId)
					ancestorTab.deactivate();
				delete this.tree.tabs[ancestorTab.id];
				browser.tabs.remove(ancestorTab.id);
			});
		},
		openTree()
		{
			var childTabs = this.children.getShallow();
			if (childTabs.length == 0)
			{
				this.removeAttribute("tree-twisty");
				return;
			}
			this.setAttribute("tree-twisty", "open");
			childTabs.forEach(childTab => 
			{
				childTab.removeAttribute("hidden");
				if (childTab.getAttribute("tree-twisty") == "open")
					childTab.openTree();
			});
			this.tree.save();
		},
		closeTree()
		{
			var ancestorTabs = this.children.getDeep();
			if (ancestorTabs.length == 0)
			{
				this.removeAttribute("tree-twisty");
				return;
			}
			this.setAttribute("tree-twisty", "closed");
			ancestorTabs.forEach(ancestorTab => ancestorTab.setAttribute("hidden"));
			this.tree.save();
		}
	}

	newTabObj.children = newChildren(newTabObj.tree, newTabObj);
	newTabObj.node.setAttribute("tab-id", tabId);
	
	return newTabObj;
}

function newTabNode()
{
	var tabNode = document.createElement("div");
	tabNode.classList.add("tab");
	tabNode.setAttribute("tab-id", "");
	tabNode.setAttribute("tree-level", "0");

	tabNode.addEventListener("mouseenter", event => tabMouseEvents(event));
	tabNode.addEventListener("mousemove", event => tabMouseEvents(event));
	tabNode.addEventListener("mouseleave", event => tabMouseEvents(event));
	tabNode.addEventListener("mousedown", event => tabMouseEvents(event));
	tabNode.addEventListener("mouseup", event => tabMouseEvents(event));

	var tabTwistyOpen = document.createElement("div");
	tabTwistyOpen.classList.add("tab-twisty-open");
	tabTwistyOpen.appendChild(document.createTextNode("➕"));
	tabNode.appendChild(tabTwistyOpen);

	var tabTwistyClose = document.createElement("div");
	tabTwistyClose.classList.add("tab-twisty-close");
	tabTwistyClose.appendChild(document.createTextNode("➖"));
	tabNode.appendChild(tabTwistyClose);

	var tabFavIcon = document.createElement("div");
	tabFavIcon.classList.add("tab-favicon");
	var tabFavIconImg = document.createElement("img");
	tabFavIconImg.src = "favicon_default.png";
	tabFavIcon.appendChild(tabFavIconImg);
	tabNode.appendChild(tabFavIcon);

	var tabFavIconLoading = document.createElement("div");
	tabFavIconLoading.classList.add("tab-favicon-loading");
	var tabFavIconLoadingImg = document.createElement("img");
	tabFavIconLoadingImg.src = "favicon_loading.gif";
	tabFavIconLoading.appendChild(tabFavIconLoadingImg);
	tabNode.appendChild(tabFavIconLoading);

	var tabTitle = document.createElement("div");
	tabTitle.classList.add("tab-title");
	tabTitle.appendChild(document.createTextNode(""));
	tabNode.appendChild(tabTitle);

	var tabClose = document.createElement("div");
	tabClose.classList.add("tab-close");
	tabClose.appendChild(document.createTextNode("❌"));
	tabNode.appendChild(tabClose);

	return tabNode;
}

// ~~~~~~~~~~~~~~~~~~~ //
// tab children object //
// ~~~~~~~~~~~~~~~~~~~ //

function newChildren(inTree, inTab)
{
	var newChildrenObj =
	{
		ids : [],
		tree : inTree,
		tab : inTab,
		insert(addTab, adjTabId, doInsertBefore)
		{
			var adjTabIdIndex = this.ids.indexOf(adjTabId);
			if (adjTabIdIndex == -1)
				return; // eRRoR

			this.ids.splice(doInsertBefore ? adjTabIdIndex : adjTabIdIndex + 1, 0, addTab.id);
			if (this.tab && this.ids.length == 1)
				this.tab.setAttribute("tree-twisty", "open");
			this.fix(addTab);
		},
		append(addTab)
		{
			this.ids.push(addTab.id);
			if (this.tab && this.ids.length == 1)
				this.tab.setAttribute("tree-twisty", "open");
			this.fix(addTab);
		},
		fix(fixTab)
		{
			fixTab.parent = this.tab ? this.tab.id : null;
			fixTab.setTreeLevel(this.tab ? this.tab.treeLevel + 1 : 0);

			var fixChildIndex = this.ids.indexOf(fixTab.id);
			var beforeFixTab = fixChildIndex == 0 ? this.tab : this.tree.getTab(this.ids[fixChildIndex - 1]).children.getLastDeep();
			if (beforeFixTab)
				beforeFixTab.node.insertAdjacentElement("afterend", fixTab.node);
			else
				this.tree.node.prepend(fixTab.node);

			var doHide = this.tab && (this.tab.getAttribute("tree-twisty") == "closed" || this.tab.hasAttribute("hidden"));
			if (doHide)
				fixTab.setAttribute("hidden");

			var lastAddedNode = fixTab.node;
			var movedIds = [fixTab.id];
			fixTab.children.getDeep().forEach(fixAncestorTab =>
			{
				lastAddedNode.insertAdjacentElement("afterend", fixAncestorTab.node);
				lastAddedNode = fixAncestorTab.node;
				movedIds.push(fixAncestorTab.id);
				if (doHide)
					fixAncestorTab.setAttribute("hidden");
			});

			var fixTreeIndex = beforeFixTab ? this.tree.idOrder.indexOf(beforeFixTab.id) + 1 : 0;
			this.tree.idOrder.splice(fixTreeIndex, 0, ...movedIds);
			browser.tabs.move(this.tree.idOrder, { windowId : currentWindowId, index : 0 }); // moving all unnecessary

			this.tree.save();
		},
		remove(removeTab, doPromote = false)
		{
			var removeChildIndex = this.ids.indexOf(removeTab.id);
			if (removeChildIndex == -1)
				return;

			var removeTreeIndex = this.tree.idOrder.indexOf(removeTab.id);

			if (doPromote)
			{
				var removeChildrenTabs = removeTab.children.getShallow();
				if (removeChildrenTabs.length > 0)
				{
					var removeHidden = removeTab.hasAttribute("hidden");
					var removeTwisty = removeTab.getAttribute("tree-twisty");
					removeChildrenTabs[0].drop(removeTab.id, "below");
					for (var i = 1; i < removeChildrenTabs.length; i++)
					{ 
						removeChildrenTabs[i].drop(removeChildrenTabs[0].id, "on");
					}
					
					if (removeHidden)
						removeChildrenTabs[0].setAttribute("hidden");
					else
						removeChildrenTabs[0].removeAttribute("hidden");

					if (removeTwisty == "open")
						removeChildrenTabs[0].openTree();
					else if (removeTwisty == "closed")
						removeChildrenTabs[0].closeTree();
				}
				this.tree.idOrder.splice(removeTreeIndex, 1);
			}
			else
			{
				var removeAncestorTabs = removeTab.children.getDeep();
				removeAncestorTabs.forEach(ancestorTab => ancestorTab.node.remove());
				this.tree.idOrder.splice(removeTreeIndex, removeAncestorTabs.length + 1);
			}
	
			removeTab.node.remove();
			this.ids.splice(removeChildIndex, 1);

			if (this.tab && this.ids.length == 0)
				this.tab.removeAttribute("tree-twisty");

			this.tree.save();
		},
		getShallow()
		{
			return this.ids.map(childTabId => this.tree.getTab(childTabId));
		},
		getDeep()
		{
			var deepchildrenIds = [];
			this.getShallow().forEach(childTab => deepchildrenIds.push(childTab, ...childTab.children.getDeep()));
			return deepchildrenIds;
		},
		getLastDeep()
		{
			if (this.ids.length == 0)
				return this.tab;

			var last = this.tree.getTab(this.ids[this.ids.length - 1]);
			while(last.children.ids.length > 0)
			{
				last = this.tree.getTab(last.children.ids[last.children.ids.length - 1]);
			}
			return last;
		}
	}
	
	return newChildrenObj;
}

// ~~~~~~~~~~~~~~~~ //
// tab mouse events //
// ~~~~~~~~~~~~~~~~ //

var mouseOverTab = null;
var clickStartTab = null;

var mouseOver = "hovering";
var clickStart = null;

var tabDropSwitch = null;

function tabMouseEvents(event)
{
	event.stopPropagation();

	var eventInfo =
	{
		mousePos : { x : event.pageX, y : event.pageY },
		type : event.type,
		tab : tree.getTab(event.currentTarget.getAttribute("tab-id")),
		target : event.target,
		tabDropSwitch : "on"
	};

	var tabDropProportion = (eventInfo.mousePos.y - eventInfo.tab.node.offsetTop) / eventInfo.tab.node.offsetHeight;
	var tabDropComparison = 0.33;
	if (tabDropProportion < tabDropComparison)
		eventInfo.tabDropSwitch = "above";
	else if (tabDropProportion > (1 - tabDropComparison))
		eventInfo.tabDropSwitch = "below";
	
	switch(eventInfo.type)
	{
		case "mousemove":
			if ((tabDropSwitch == null) || (eventInfo.tabDropSwitch == tabDropSwitch))
				break; // note doesn't always break // can fall through to "mouseenter"
		case "mouseenter":
			if (mouseOver)
				tabMouseEnter(eventInfo);
		break;

		case "mouseleave":
			if (mouseOver)
				tabMouseLeave(eventInfo);
		break;

		case "mousedown":
			if (mouseOver == "hovering")
				tabStartClick(eventInfo);
		break;

		case "mouseup":
			if (clickStart)
				tabEndClick(eventInfo);
		break;
	}
}

function tabMouseEnter(eventInfo)
{
	tabMouseLeave(eventInfo);
	mouseOverTab = eventInfo.tab;
	tabDropSwitch = eventInfo.tabDropSwitch;

	if (mouseOver == "hovering")
	{
		eventInfo.tab.setAttribute("mouse-over", "hover");
	}
	else if (mouseOver == "dragging")
	{
		if (eventInfo.tab == clickStartTab)
			eventInfo.tab.setAttribute("mouse-over", "drag-on");
		else
			eventInfo.tab.setAttribute("mouse-over", "drag-" + eventInfo.tabDropSwitch);
	}
}

function tabMouseLeave(eventInfo)
{
	eventInfo.tab.removeAttribute("mouse-over");
	mouseOverTab = null;
	tabDropSwitch = null;
}

function tabStartClick(eventInfo)
{
	if (!eventInfo.target.classList)
		return;
		
	tabMouseLeave(eventInfo);

	var clickables = ["tab-close", "tab-twisty-close", "tab-twisty-open"];
	var clickablesFiltered = clickables.filter(clickable => eventInfo.target.classList.contains(clickable));

	clickStartTab = eventInfo.tab;

	if (clickablesFiltered.length == 0)
	{
		mouseOver = "dragging";
		clickStart = "drag-start";
		tabMouseEnter(eventInfo);
	}
	else
	{
		mouseOver = null;
		clickStart = clickablesFiltered[0];
	}

	clickStartTab.setAttribute("clicking", clickStart);
}

function tabEndClick(eventInfo)
{
	if ((eventInfo.target.classList) && (eventInfo.target.classList.contains(clickStart)) && (eventInfo.tab == clickStartTab))
	{
		switch(clickStart)
		{
			case "tab-close":
				browser.tabs.remove(clickStartTab.id);
			break;

			case "tab-twisty-open":
				clickStartTab.openTree();
			break;

			case "tab-twisty-close":
				clickStartTab.closeTree();
			break;
		}
	}
	else if ((clickStart == "drag-start") && eventInfo.tab)
	{
		if (clickStartTab.id == eventInfo.tab.id)
			browser.tabs.update(clickStartTab.id, { "active" : true });
		else
			clickStartTab.drop(eventInfo.tab.id, eventInfo.tabDropSwitch);
	}

	clickStartTab.removeAttribute("clicking");
	clickStartTab = null;
	clickStart = null;
	mouseOver = "hovering";

	tabMouseEnter(eventInfo);
}

function outsideEndClick(event)
{
	event.stopPropagation()

	if (clickStart)
	{
		clickStartTab.removeAttribute("clicking");
		clickStartTab = null;
		clickStart = null;
		mouseOver = "hovering";
	}
}