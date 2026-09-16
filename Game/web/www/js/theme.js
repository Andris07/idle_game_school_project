const themeToggleButton = document.getElementById("theme-toggle");

themeToggleButton.addEventListener("click", () =>
{
    const currentTheme = document.body.dataset.theme;

    document.body.dataset.theme = currentTheme === "dark" ? "light" : "dark";
});