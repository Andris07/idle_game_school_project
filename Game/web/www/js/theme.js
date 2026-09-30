const themeToggleButton = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("theme");

if (savedTheme)
{
    document.body.dataset.theme = savedTheme;
}

themeToggleButton.addEventListener("click", () =>
{
    const currentTheme = document.body.dataset.theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.body.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme);
});