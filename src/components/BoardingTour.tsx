import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Colors } from "@/src/constants/theme";
import { useTheme } from "@/src/contexts/ThemeContext";

export interface BoardingStep {
  title: string;
  description: string;
}

interface BoardingTourProps {
  storageKey: string;
  steps: BoardingStep[];
  onClose?: () => void;
}

const STORAGE_PREFIX = "auditapp:boarding:";

const BoardingTour: React.FC<BoardingTourProps> = ({
  storageKey,
  steps,
  onClose,
}) => {
  const { colors } = useTheme();
  const palette = colors ?? Colors.light;
  const [isReady, setIsReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const safeSteps = useMemo(
    () => (steps && steps.length > 0 ? steps : []),
    [steps]
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const key = `${STORAGE_PREFIX}${storageKey}`;
        const stored = await AsyncStorage.getItem(key);
        if (isMounted && stored !== "done" && safeSteps.length > 0) {
          setVisible(true);
        }
      } catch (error) {
        console.warn("BoardingTour: cannot read storage", error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [storageKey, safeSteps.length]);

  const markCompleted = async () => {
    try {
      const key = `${STORAGE_PREFIX}${storageKey}`;
      await AsyncStorage.setItem(key, "done");
    } catch (error) {
      console.warn("BoardingTour: cannot persist state", error);
    }
  };

  const closeTour = async () => {
    await markCompleted();
    setVisible(false);
    onClose?.();
  };

  const handleNext = async () => {
    if (activeStep >= safeSteps.length - 1) {
      await closeTour();
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleSkip = async () => {
    await closeTour();
  };

  if (!isReady || !visible || safeSteps.length === 0) {
    return null;
  }

  const currentStep = safeSteps[activeStep];
  const progressLabel = `Bước ${activeStep + 1}/${safeSteps.length}`;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.background,
              borderColor: palette.icon + "30",
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.progressText, { color: palette.icon }]}>
              {progressLabel}
            </Text>
            <TouchableOpacity onPress={handleSkip} hitSlop={16}>
              <Text style={[styles.skipText, { color: palette.icon }]}>
                Bỏ qua
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, { color: palette.text }]}>
            {currentStep.title}
          </Text>
          <Text style={[styles.description, { color: palette.icon }]}>
            {currentStep.description}
          </Text>

          <View style={styles.dotRow}>
            {safeSteps.map((_, index) => (
              <View
                key={`tour-dot-${index}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === activeStep ? palette.primary : palette.icon + "30",
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: palette.primary }]}
            onPress={handleNext}
          >
            <Text style={styles.ctaText}>
              {activeStep === safeSteps.length - 1
                ? "Đã hiểu"
                : "Tiếp tục"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
  },
  skipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default BoardingTour;

