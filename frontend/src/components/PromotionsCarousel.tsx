export function PromotionsCarousel() {
    return (
        <section className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[280px] h-40 bg-gradient-to-br from-element-bg to-element-hover-bg rounded-xl border border-white/5 p-4 flex flex-col justify-end relative overflow-hidden group">
                    <div className="absolute inset-0 bg-accent-solid/5 group-hover:bg-accent-solid/10 transition-colors" />
                    <span className="text-accent-solid font-bold text-lg relative z-10">Casino Bonus</span>
                    <span className="text-text-muted text-sm relative z-10">100% up to 500€</span>
                </div>
            ))}
        </section>
    );
}
