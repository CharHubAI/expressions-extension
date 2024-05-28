import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), dts({
        outDir: ['dist'],
        include: ['src/**/*.ts*'],
        staticImport: true,
        rollupTypes: true,
        insertTypesEntry: true
    })],
    build: {
        lib: {
            entry: ['./src/index.tsx'],
            name: "index",
            fileName: 'index',
            formats: ['cjs', 'umd', 'iife', 'es']
        },
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            },
        },
    }
})
