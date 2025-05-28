#!/bin/bash

# Function to convert a single file from .js to .ts
convert_file() {
    local file=$1
    if [[ -f "$file" && "${file##*.}" == "js" ]]; then
        local ts_file="${file%.*}.ts"
        echo "Converting $file to $ts_file"
        mv "$file" "$ts_file"
    fi
}

# Convert all .js files in src and config directories
find src config -type f -name "*.js" | while read file; do
    convert_file "$file"
done

echo "Conversion complete. Please review and update the TypeScript files as needed." 