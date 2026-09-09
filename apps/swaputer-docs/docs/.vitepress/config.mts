import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "Swaputer Docs",
  description: "Swaputer turns Uniswap v4 pools into programmable onchain worlds. Learn the protocol, SVM, and TinySol.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  vite: {
    server: {
      allowedHosts: ["nominated-marijuana-paul-luck.trycloudflare.com"]
    }
  },
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/swaputer-mark.png" }],
    ["meta", { name: "theme-color", content: "#111111" }]
  ],
  themeConfig: {
    logo: "/swaputer-mark.png",
    siteTitle: "Swaputer",
    sidebar: [
      {
        text: "Start Here",
        items: [
          { text: "What is Swaputer?", link: "/" },
          { text: "What Can Be Built", link: "/protocol/use-cases" }
        ]
      },
      {
        text: "Protocol",
        items: [
          { text: "Core Model", link: "/protocol/overview" },
          { text: "Execution & Settlement", link: "/protocol/execution" },
          { text: "SVM Programs", link: "/protocol/programs" },
          { text: "Security & Trust Model", link: "/protocol/security" },
          { text: "Concepts & Terminology", link: "/protocol/glossary" }
        ]
      },
      {
        text: "Developers",
        items: [
          { text: "Quickstart", link: "/developers/quickstart" },
          { text: "npm Tooling Packages", link: "/developers/tooling-packages" },
          { text: "Build Your First Program", link: "/developers/first-program" },
          { text: "TinySol", link: "/developers/tinysol" },
          { text: "Actions & Signatures", link: "/developers/actions" },
          { text: "Deploy & Call", link: "/developers/deploy-and-call" },
          { text: "Events & Indexing", link: "/developers/events-indexing" },
          { text: "Verify a Deployment", link: "/developers/deployments" }
        ]
      },
    ],
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Search docs", buttonAriaLabel: "Search docs" },
          modal: {
            noResultsText: "No results found",
            resetButtonTitle: "Clear search",
            footer: { selectText: "Select", navigateText: "Navigate", closeText: "Close" }
          }
        }
      }
    },
    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous page", next: "Next page" },
    lastUpdated: { text: "Last updated" },
    darkModeSwitchLabel: "Appearance",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Back to top",
    footer: {
      message: "Programmable onchain worlds built on Uniswap v4 Hooks.",
      copyright: "Swaputer Protocol"
    }
  }
});
