export interface TronColor {
    hex: number;
    name: string;
}

export class ColorUtils {
    private static readonly TRON_COLORS: TronColor[] = [
        { hex: 0x00ffff, name: 'cyan' },     // Bright cyan
        { hex: 0xff00ff, name: 'magenta' },  // Electric magenta
        { hex: 0x00ff7f, name: 'green' },    // Bright spring green
        { hex: 0xff003c, name: 'red' },      // Vibrant red
        { hex: 0xae00ff, name: 'purple' },   // Electric purple
        { hex: 0xff61ab, name: 'pink' },     // Hot pink
        { hex: 0x39ff14, name: 'lime' },     // Neon lime
        { hex: 0xffdd00, name: 'yellow' },   // Electric yellow
        { hex: 0x00c8ff, name: 'blue' }      // Classic Tron blue (brighter)
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

    static getAllTronColors(): TronColor[] {
        return Object.values(this.TRON_COLORS);
    }
} 