const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  
  // Get white bg elements with children <= 4 (likely containers)
  const info = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll("*").forEach(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg === "rgb(255, 255, 255)" && el.children?.length <= 4) {
        results.push({ tag: el.tagName.toLowerCase(), class: (el.className||"").toString().split(" ").filter(c => c.startsWith("Mui")).join(","), htmlLen: el.innerHTML.length, childCount: el.children?.length || 0 });
      }
    });
    return results;
  });
  console.log(JSON.stringify(info, null, 2));
  
  // Dump DOM structure
  const dom = await page.evaluate(() => {
    function walk(node, depth) {
      if (depth > 6 || !node.children?.length) return '';
      let out = '';
      for (const child of node.children) {
        const cls = (child.className||"").toString().split(" ").filter(c => c.startsWith("Mui")).join(",");
        out += "  ".repeat(depth) + "<" + child.tagName.toLowerCase() + (cls ? ' class="' + cls.slice(0,100) + '"' : "") + ">\n";
        out += walk(child, depth + 1);
      }
      return out;
    }
    return document.getElementById("root") ? walk(document.getElementById("root"), 0) : "no root";
  });
  console.log("=== DOM ===");
  console.log(dom);
  
  await browser.close();
})();
