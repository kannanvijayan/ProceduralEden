import * as shell from "shelljs";

// Copy all the view templates
shell.mkdir("dist/public");
shell.cp( "-R", "src/public/index.html", "dist/public/" );