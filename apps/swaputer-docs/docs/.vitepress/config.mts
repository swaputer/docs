import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "Swaputer Docs",
  description: "Swaputer turns Uniswap v4 pools into programmable onchain worlds. Learn the protocol, SVM, and TinySol.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: false,
  vite: {
    server: {
      allowedHosts: ["nominated-marijuana-paul-luck.trycloudflare.com"]
    }
  },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/swaputer-mark.png" }],
    ["meta", { name: "theme-color", content: "#ff37c7" }]
  ],
  themeConfig: {
    logo: "/swaputer-mark.png",
    siteTitle: "Swaputer",
    nav: [
      { text: "Ecosystem", link: "https://swaputer.com" },
      { text: "Studio", link: "https://studio.swaputer.com" },
      { text: "Scan", link: "https://scan.swaputer.com" }
    ],
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "What is Swaputer?", link: "/" },
          { text: "Architecture in 5 Minutes", link: "/architecture" }
        ]
      },
      {
        text: "Core Concepts",
        items: [
          { text: "Core Model", link: "/protocol/overview" },
          { text: "Execution & Settlement", link: "/protocol/execution" },
          { text: "SVM Programs", link: "/protocol/programs" },
          { text: "Security & Trust Model", link: "/protocol/security" },
          { text: "What Can Be Built", link: "/protocol/use-cases" }
        ]
      },
      {
        text: "Developer Guides",
        items: [
          { text: "Address", link: "/developers/deployments" },
          { text: "Developer Quickstart", link: "/developers/quickstart" },
          { text: "Build Your First Program", link: "/developers/first-program" },
          { text: "Deploy, Call & Read", link: "/developers/deploy-and-call" },
          { text: "Build a Client", link: "/developers/frontend-integration" },
          { text: "Integrate EVM and SVM", link: "/developers/evm-svm-integration" },
          { text: "Events & Indexing", link: "/developers/events-indexing" }
        ]
      },
      {
        text: "Application Patterns",
        items: [
          { text: "ETH-Backed SRC20", link: "/patterns/eth-backed-src20" },
          { text: "Atomic ETH/SRC20 Market", link: "/patterns/atomic-market" }
        ]
      },
      {
        text: "Reference",
        items: [
          { text: "TinySol Language", link: "/developers/tinysol" },
          { text: "SVM Context", link: "/developers/svm-context" },
          { text: "Actions & Signatures", link: "/developers/actions" },
          { text: "npm Tooling Packages", link: "/developers/tooling-packages" },
          { text: "Concepts & Terminology", link: "/protocol/glossary" }
        ]
      },
    ],
    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous page", next: "Next page" },
    lastUpdated: { text: "Last updated" },
    // Appearance switch disabled in docs via `appearance: false`
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Back to top",
    footer: {
      message: "Programmable onchain worlds built on Uniswap v4 Hooks.",
      copyright: "Swaputer Protocol"
    }
  }
});
