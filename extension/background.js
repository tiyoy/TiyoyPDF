// TiyoyPDF Chrome Extension - Background Service Worker

const TIYOYPDF_URL = 'https://tiyoypdf.example.com/en';

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    // Create main context menu item
    chrome.contextMenus.create({
        id: 'tiyoypdf-open',
        title: 'Open with TiyoyPDF',
        contexts: ['link', 'page']
    });

    // Create submenu for specific tools
    chrome.contextMenus.create({
        id: 'tiyoypdf-merge',
        parentId: 'tiyoypdf-open',
        title: 'Merge PDFs',
        contexts: ['link', 'page']
    });

    chrome.contextMenus.create({
        id: 'tiyoypdf-compress',
        parentId: 'tiyoypdf-open',
        title: 'Compress PDF',
        contexts: ['link', 'page']
    });

    chrome.contextMenus.create({
        id: 'tiyoypdf-convert',
        parentId: 'tiyoypdf-open',
        title: 'Convert to PDF',
        contexts: ['link', 'page']
    });

    chrome.contextMenus.create({
        id: 'tiyoypdf-all-tools',
        parentId: 'tiyoypdf-open',
        title: 'All Tools →',
        contexts: ['link', 'page']
    });

    console.log('TiyoyPDF context menus created');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    let url = TIYOYPDF_URL;

    switch (info.menuItemId) {
        case 'tiyoypdf-merge':
            url = `${TIYOYPDF_URL}/tools/merge-pdf`;
            break;
        case 'tiyoypdf-compress':
            url = `${TIYOYPDF_URL}/tools/compress-pdf`;
            break;
        case 'tiyoypdf-convert':
            url = `${TIYOYPDF_URL}/tools/jpg-to-pdf`;
            break;
        case 'tiyoypdf-all-tools':
        case 'tiyoypdf-open':
            url = TIYOYPDF_URL;
            break;
        default:
            url = TIYOYPDF_URL;
    }

    // Open TiyoyPDF in a new tab
    chrome.tabs.create({ url: url });
});

// Log when service worker starts
console.log('TiyoyPDF background service worker started');
