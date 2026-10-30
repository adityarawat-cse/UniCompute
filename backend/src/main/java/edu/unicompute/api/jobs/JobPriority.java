package edu.unicompute.api.jobs;

public enum JobPriority {
    LOW(1, "Low"),
    NORMAL(2, "Normal"),
    HIGH(3, "High");

    private final int level;
    private final String label;

    JobPriority(int level, String label) {
        this.level = level;
        this.label = label;
    }

    public int getLevel() {
        return level;
    }

    public String getLabel() {
        return label;
    }

    public static JobPriority fromLevel(int level) {
        for (JobPriority p : values()) {
            if (p.level == level) {
                return p;
            }
        }
        return NORMAL;
    }

    public static JobPriority fromString(String name) {
        if (name == null || name.isBlank()) {
            return NORMAL;
        }
        for (JobPriority p : values()) {
            if (p.name().equalsIgnoreCase(name.trim()) || p.label.equalsIgnoreCase(name.trim())) {
                return p;
            }
        }
        try {
            int lvl = Integer.parseInt(name.trim());
            return fromLevel(lvl);
        } catch (NumberFormatException ignored) {
            return NORMAL;
        }
    }
}

