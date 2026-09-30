const themeToggleButton = document.getElementById("theme-toggle");

themeToggleButton.addEventListener("click", () =>
{
    const currentTheme = document.documentElement.dataset.theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
});