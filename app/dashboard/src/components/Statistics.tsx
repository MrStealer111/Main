import { Box, BoxProps, Card, chakra, HStack, Text, VStack, Progress } from "@chakra-ui/react";
import {
  ChartBarIcon,
  ChartPieIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useDashboard } from "contexts/DashboardContext";
import { FC, PropsWithChildren, ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "react-query";
import { fetch } from "service/http";
import { formatBytes, numberWithCommas } from "utils/formatByte";

const TotalUsersIcon = chakra(UsersIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const NetworkIcon = chakra(ChartBarIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const MemoryIcon = chakra(ChartPieIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const CpuIcon = chakra(CpuChipIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

const ServerIcon = chakra(ServerStackIcon, {
  baseStyle: { w: 5, h: 5, position: "relative", zIndex: "2" },
});

type StatisticCardProps = {
  title: string;
  content: ReactNode;
  icon: ReactElement;
};

const StatisticCard: FC<PropsWithChildren<StatisticCardProps>> = ({
  title,
  content,
  icon,
}) => {
  return (
    <Card
      p={5}
      borderWidth="1px"
      borderColor="light-border"
      bg="#F9FAFB"
      _dark={{ borderColor: "gray.600", bg: "gray.750" }}
      borderStyle="solid"
      boxShadow="none"
      borderRadius="12px"
      width="full"
      display="flex"
      justifyContent="space-between"
      flexDirection="row"
      className="stat-card"
    >
      <VStack alignItems="flex-start" spacing={1}>
        <Text
          color="gray.500"
          _dark={{ color: "rgba(255,255,255,0.5)" }}
          fontWeight="600"
          textTransform="uppercase"
          fontSize="xs"
          letterSpacing="0.05em"
        >
          {title}
        </Text>
        <Box className="stat-value" fontSize="2xl" fontWeight="700" lineHeight="1.2">
          {content}
        </Box>
      </VStack>
      <Box
        className="stat-icon"
        color="#00d4ff"
        p={3}
        borderRadius="12px"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {icon}
      </Box>
    </Card>
  );
};

export const StatisticsQueryKey = "statistics-query-key";

export const Statistics: FC<BoxProps> = (props) => {
  const { version } = useDashboard();
  const { data: systemData } = useQuery({
    queryKey: StatisticsQueryKey,
    queryFn: () => fetch("/system"),
    refetchInterval: 5000,
    onSuccess: ({ version: currentVersion }) => {
      if (version !== currentVersion)
        useDashboard.setState({ version: currentVersion });
    },
  });
  const { t } = useTranslation();

  const memPercent = systemData
    ? Math.round((systemData.mem_used / systemData.mem_total) * 100)
    : 0;

  return (
    <HStack
      justifyContent="space-between"
      gap={4}
      display="flex"
      flexDirection={{ lg: "row", base: "column" }}
      flexWrap="wrap"
      {...props}
    >
      <StatisticCard
        title={t("activeUsers")}
        content={
          systemData && (
            <HStack spacing={1}>
              <Text as="span" className="stat-value" display="inline" fontSize="2xl">
                {numberWithCommas(systemData.users_active)}
              </Text>
              <Text as="span" fontSize="sm" color="gray.500" _dark={{ color: "gray.500" }} fontWeight="normal">
                / {numberWithCommas(systemData.total_user)}
              </Text>
            </HStack>
          )
        }
        icon={<TotalUsersIcon />}
      />
      <StatisticCard
        title={t("dataUsage")}
        content={
          systemData &&
          formatBytes(
            systemData.incoming_bandwidth + systemData.outgoing_bandwidth
          )
        }
        icon={<NetworkIcon />}
      />
      <StatisticCard
        title={t("memoryUsage")}
        content={
          systemData && (
            <VStack align="start" spacing={1} w="full">
              <HStack spacing={1}>
                <Text className="stat-value" fontSize="lg">
                  {formatBytes(systemData.mem_used, 1, true)[0]}
                </Text>
                <Text fontSize="xs" color="gray.500" fontWeight="normal">
                  {formatBytes(systemData.mem_used, 1, true)[1]} /{" "}
                  {formatBytes(systemData.mem_total, 1)}
                </Text>
              </HStack>
              <Progress
                value={memPercent}
                size="xs"
                w="full"
                borderRadius="full"
                colorScheme="cyan"
                bg="gray.700"
              />
            </VStack>
          )
        }
        icon={<MemoryIcon />}
      />
    </HStack>
  );
};
