const button = document.getElementById("theme-toggle");

button.addEventListener("click", () =>
{
    const currentTheme = document.body.dataset.theme;

    document.body.dataset.theme = currentTheme === "dark" ? "light" : "dark";
});