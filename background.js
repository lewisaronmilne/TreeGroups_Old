// on toolbar button clicked
browser.browserAction.onClicked.addListener(openSidebar);
function openSidebar(currentTab) 
{
	var currentWindow = currentTab.windowId;
	
	browser.sidebarAction.setPanel({ panel: (browser.extension.getURL("/about:blank")), windowId: currentWindow });
	browser.sidebarAction.setPanel({ panel: (browser.extension.getURL("/sidebar.html")), windowId: currentWindow });
	browser.sidebarAction.open();
}

// ~~~~~~~~~~~~~ //
// new from here //
// ~~~~~~~~~~~~~ //

var trees = [];

Promise.all(
[
	browser.windows.getAll({ populate : true }),
	browser.storage.local.get("groups")
]).then(function(promises)
{
	var ffTabs = promises[0];
	currentWindowId = ffTabs[0].windowId;

	tree = newTree(ffTabs);
});