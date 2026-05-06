#!/bin/bash

if ! command -v ast-grep >/dev/null 2>&1; then
    echo "Skipping icon path check: ast-grep is not installed."
    exit 0
fi

icon_path_output=$(ast-grep scan -r .rules/noAbsoluteIconPath.yml 2>/dev/null)

if [ -z "$icon_path_output" ]; then
    exit 0
fi

echo "⚠️  Issue:"
echo "Icon paths (iconPath or selectedIconPath) must use relative paths starting with './'."
echo "Affected locations:"
echo "$icon_path_output"

exit 1
