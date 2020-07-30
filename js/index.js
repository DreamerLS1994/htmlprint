// 获取当前选项卡ID
function getCurrentTabId(callback)
{
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs)
	{
		if(callback) callback(tabs.length ? tabs[0].id: null);
	});
}

// 向content-script注入JS片段
function executeScriptToCurrentTab(code)
{
	getCurrentTabId((tabId) =>
	{
		chrome.tabs.executeScript(tabId, {code: code});
	});
}

function getCurrentWeb(callback)
{
    chrome.tabs.getSelected(null, function (tab) {
    if(callback) callback(tab.url);
    });
}

$('#print_html').click(() => {
    getCurrentWeb((web) =>
    {
        //提取出网址
        var strs = new Array();
        strs = web.split("/");
        var host = strs[2];
        console.log(web);
        //挨个判断  懒得优化
        switch(host)
        {
            case "blog.csdn.net":
                executeScriptToCurrentTab(`$(".toc, .bottom-pub-footer").remove();$("#comment_title, #comment_list, #comment_bar, #comment_form, .announce, #ad_cen, #ad_bot").remove();$(".nav_top_2011, #header, #navigator, #side, #dmp_ad_58").remove();$(".p4course_target, .comment-box, .recommend-box, #csdn-toolbar, #tool-box").remove();$("aside").remove();$(".tool-box, .more-toolbox, .csdn-side-toolbar").remove();$("main").css('display','content'); $("main").css('float','left'); $("main").css('width','1000px'); $("main").css('margin-left','-300px'); window.print();`);
                break;
            case "www.jianshu.com":
                executeScriptToCurrentTab(`$("header").remove();$("aside").remove();$("footer").remove();$("#note-page-comment").remove();$(".sFiE8U").remove();$("._13lIbp").remove();$(".d0hShY").remove();$("._1kCBjS").remove();$("._3Pnjry").remove();$(".ant-back-top").remove(); window.print();`)
                break;
            case "www.cnblogs.com":
                executeScriptToCurrentTab(`$("#page_begin_html, #sidebar, #sideBar, #reader_catalog, #xiaociguai, #blog_post_info_block, #banner, #rightmenu, #myRewards, #big_banner, #header, #div_digg, #comment_form, #footer, #page_end_html, #leftmenu, #blog-comments-placeholder, #mytopmenu, #leftcontent, #uprightsideBar, #right_content").remove();$(".header, .navs, .sidebar, .top_banner, .fast-comment, .tctip, .esa-catalog, .esa-toolbar, .markdown-nav-wrapper, .footer").remove(); $("#home, #centercontent").css('display','content'); $("#home, #centercontent").css('float','left'); $("#home, #centercontent").css('margin','50px');$("#home, #centercontent").css('padding','50px');$("#main").css('width','100%'); $("#main").css('display','inline-table'); $("#mainContent, .forFlow, #content").css('margin','0');$("#mainContent, .forFlow").css('float','none');$("#mainContent").css('width','900px');window.print();`);
                break;
            case "new.qq.com":
                executeScriptToCurrentTab(`$("#TopNav, #Recomend, #RIGHT , #Comment, #Foot, #GoTop").remove();window.print();`);
                break;
            case "www.jb51.net":
                executeScriptToCurrentTab(`$(".main-right, .xgcomm, .lbd, .lbd_bot, .pt10, .breadcrumb, .search").remove();$("#topbar, #header, #nav, #submenu, #comments, #footer, #right-share").remove();$("#main").css('display','content'); $("#main").css('float','left'); $("#main").css('width','1000px'); $("#main").css('margin-left','100px'); window.print();`);                
                break;

            case "jingyan.baidu.com":
                executeScriptToCurrentTab(`$(".header, .wgt-common-nav, .main-aside, .wrp-exp-share, .exp-item-list, .main-content-bottom, .magzine-list, .footer, .wgt-left-promo, .breadcrumb, .wgt-like, .top-nav-bar, .wgt-comments, .wgt-exp-share").remove();$("#main-content").css('width','auto'); $("#main-content").css('margin','80px');window.print();`);
                break;

            default:
                break;

        }
    });
    
});

// 新标签打开网页
$('#update_url').click(() => {
    
    chrome.tabs.create({url: 'https://jerrycoding.com/article/html-print/'});
});

$('#about_url').click(() => {
    
    chrome.tabs.create({url: 'https://jerrycoding.com/article/html-print/'});
});