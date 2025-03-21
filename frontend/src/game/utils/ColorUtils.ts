export interface TronColor {
    hex: number;
    name: string;
}

export class ColorUtils {
    private static readonly TRON_COLORS: TronColor[] = [
        { hex: 0x0fbef2, name: 'blue' },    // Classic Tron blue
        { hex: 0xffd400, name: 'yellow' },   // Bright yellow
        { hex: 0x00ff00, name: 'green' },    // Neon green
        { hex: 0xff0044, name: 'red' },      // Bright red
        { hex: 0x9400d3, name: 'purple' },   // Deep purple
        { hex: 0xff1493, name: 'pink' },     // Deep pink
        { hex: 0x4b0082, name: 'indigo' }    // Indigo
    ];

    private static usedColors: Set<number> = new Set();

    static getRandomTronColor(): TronColor {
        // If all colors are used, reset the used colors set
        if (this.usedColors.size >= this.TRON_COLORS.length) {
            this.usedColors.clear();
        }

        // Filter out used colors
        const availableColors = this.TRON_COLORS.filter(color => !this.usedColors.has(color.hex));
        
        // Get random color from available colors
        const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        
        // Mark color as used
        this.usedColors.add(randomColor.hex);
        
        return randomColor;
    }

    static releaseColor(hex: number) {
        this.usedColors.delete(hex);
    }
} 