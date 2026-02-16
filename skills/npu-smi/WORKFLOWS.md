# npu-smi Common Workflows

Step-by-step workflows for common npu-smi operations.

## Table of Contents

1. [Device Monitoring](#device-monitoring)
2. [Device Configuration](#device-configuration)
3. [Firmware Upgrade](#firmware-upgrade)
4. [vNPU Management](#vnpu-management)
5. [Certificate Management](#certificate-management)
6. [Troubleshooting Data Collection](#troubleshooting-data-collection)

---

## Device Monitoring

### Daily Health Check

```bash
# 1. List all devices
npu-smi info -l

# 2. Check health status for each device
npu-smi info -t health -i 0
npu-smi info -t health -i 1

# 3. Check temperature for each chip
npu-smi info -t temperature -i 0 -c 0
npu-smi info -t temperature -i 0 -c 1

# 4. Check power consumption
npu-smi info -t power -i 0 -c 0

# 5. Check memory usage
npu-smi info -t memory -i 0 -c 0

# 6. Check running processes
npu-smi info -t processes -i 0 -c 0
```

### Performance Monitoring

```bash
# Monitor utilization
npu-smi info -t usages -i 0 -c 0

# Check ECC errors
npu-smi info -t ecc -i 0 -c 0

# View sensor data
npu-smi info -t sensors -i 0 -c 0

# Check frequency
npu-smi info -t freq -i 0 -c 0
```

---

## Device Configuration

### Initial Device Setup

```bash
# 1. List devices to get IDs
npu-smi info -l

# 2. Set temperature threshold (e.g., 85°C)
npu-smi set -t temperature -i 0 -c 0 -d 85

# 3. Set power limit (e.g., 300W)
npu-smi set -t power-limit -i 0 -c 0 -d 300

# 4. Enable ECC mode
npu-smi set -t ecc-mode -i 0 -c 0 -d 1

# 5. Enable persistence mode
npu-smi set -t persistence-mode -i 0 -d 1

# 6. Set compute mode (default)
npu-smi set -t compute-mode -i 0 -c 0 -d 0
```

### Fan Configuration

```bash
# Option 1: Automatic mode (recommended)
npu-smi set -t pwm-mode -d 1

# Option 2: Manual mode with custom speed
npu-smi set -t pwm-mode -d 0
npu-smi set -t pwm-duty-ratio -d 40
```

### Network Configuration

```bash
# Set MAC address for eth0
npu-smi set -t mac-addr -i 0 -c 0 -d 0 -s 00:05:xx:xx:54:16

# Set MAC address for eth1
npu-smi set -t mac-addr -i 0 -c 0 -d 1 -s 00:05:xx:xx:54:17

# Restart system to apply changes
```

### Boot Medium Configuration

```bash
# Set boot medium to M.2 SSD
npu-smi set -t boot-select -i 0 -c 1 -d 3

# Set boot medium to eMMC
npu-smi set -t boot-select -i 0 -c 1 -d 4

# Power cycle (30+ seconds off) to apply
```

---

## Firmware Upgrade

### MCU Firmware Upgrade

```bash
# 1. Query current version
npu-smi upgrade -b mcu -i 0

# 2. Upgrade firmware
npu-smi upgrade -t mcu -i 0 -f ./Ascend-hdk-310b-mcu_24.15.19.hpm

# 3. Query upgrade status
npu-smi upgrade -q mcu -i 0

# 4. Activate firmware
npu-smi upgrade -a mcu -i 0

# 5. Restart device
reboot
```

### VRD Firmware Upgrade

```bash
# 1. Query current version
npu-smi upgrade -b vrd -i 0

# 2. Upgrade firmware (no file parameter)
npu-smi upgrade -t vrd -i 0

# 3. Power cycle (30+ seconds off)
# 4. Power on to activate
```

### Bootloader Firmware Upgrade

```bash
# 1. Query current version
npu-smi upgrade -b bootloader -i 0

# 2. Upgrade firmware
npu-smi upgrade -t bootloader -i 0 -f ./bootloader.bin

# 3. Activate firmware
npu-smi upgrade -a bootloader -i 0
```

---

## vNPU Management

### Create vNPU Instance

```bash
# 1. Query AVI mode
npu-smi info -t vnpu-mode

# 2. Query available templates
npu-smi info -t template-info -i 0

# 3. Create vNPU with auto-assigned ID
npu-smi set -t create-vnpu -i 0 -c 0 -f vir02

# 4. Or create with specific ID and group
npu-smi set -t create-vnpu -i 0 -c 0 -f vir02 -v 103 -g 1

# 5. Verify vNPU creation
npu-smi info -t info-vnpu -i 0 -c 0
```

### Manage vNPU Instances

```bash
# List all vNPU instances
npu-smi info -t info-vnpu -i 0 -c 0

# Destroy vNPU instance
npu-smi set -t destroy-vnpu -i 0 -c 0 -v 103

# Enable config recovery
npu-smi set -t vnpu-cfg-recover -d 1
```

---

## Certificate Management

### Complete Certificate Workflow

```bash
# 1. Get CSR file
npu-smi info -t tls-csr-get -i 0 -c 0

# 2. Submit CSR to CA and obtain certificates
#    - TLS certificate (e.g., rsa.d2.pem)
#    - CA root certificate (e.g., rsa.rca.pem)
#    - Sub-CA certificate (e.g., rsa.oca.pem)

# 3. Import certificates
npu-smi set -t tls-cert -i 0 -c 0 -f "rsa.d2.pem rsa.rca.pem rsa.oca.pem"

# 4. Verify certificate installation
npu-smi info -t tls-cert -i 0 -c 0

# 5. Set expiration threshold (e.g., 90 days)
npu-smi set -t tls-cert-period -i 0 -c 0 -s 90

# 6. Verify threshold setting
npu-smi info -t tls-cert-period -i 0 -c 0
```

### Certificate Renewal

```bash
# 1. Check current certificate
npu-smi info -t tls-cert -i 0 -c 0

# 2. Get new CSR if needed
npu-smi info -t tls-csr-get -i 0 -c 0

# 3. Import new certificates
npu-smi set -t tls-cert -i 0 -c 0 -f "new_tls.pem new_ca.pem new_subca.pem"

# 4. Verify new certificate
npu-smi info -t tls-cert -i 0 -c 0
```

---

## Troubleshooting Data Collection

### Collect System Information

```bash
# 1. Device list
npu-smi info -l

# 2. Device health
npu-smi info -t health -i 0

# 3. Board info
npu-smi info -t board -i 0

# 4. All chips
npu-smi info -m

# 5. Temperature
npu-smi info -t temperature -i 0 -c 0

# 6. Power
npu-smi info -t power -i 0 -c 0

# 7. Memory
npu-smi info -t memory -i 0 -c 0

# 8. Processes
npu-smi info -t processes -i 0 -c 0

# 9. ECC errors
npu-smi info -t ecc -i 0 -c 0

# 10. Utilization
npu-smi info -t usages -i 0 -c 0

# 11. Sensors
npu-smi info -t sensors -i 0 -c 0

# 12. Frequency
npu-smi info -t freq -i 0 -c 0

# 13. PCIe info
npu-smi info -t pcie-info -i 0 -c 0

# 14. Firmware version
npu-smi info -t version -i 0 -c 0

# 15. Product info
npu-smi info -t product -i 0 -c 0
```

### Enable Log Collection

```bash
# Enable log persistence
npu-smi set -t sys-log-enable -d 1

# Collect logs to specific path
npu-smi set -t sys-log-dump -s 3 -f /var/log/npu

# Check logs in /var/log/npu/
```

### Clear ECC Errors

```bash
# Clear all chips ECC errors
npu-smi clear -t ecc-info -i 0

# Clear specific chip ECC errors
npu-smi clear -t ecc-info -i 0 -c 0
```

---

## Batch Operations

### Configure Multiple Devices

```bash
#!/bin/bash
# configure_all.sh

DEVICES=(0 1 2 3)
TEMP_THRESHOLD=85
POWER_LIMIT=300

for id in "${DEVICES[@]}"; do
    echo "Configuring device $id..."
    npu-smi set -t temperature -i $id -c 0 -d $TEMP_THRESHOLD
    npu-smi set -t power-limit -i $id -c 0 -d $POWER_LIMIT
    npu-smi set -t ecc-mode -i $id -c 0 -d 1
done
```

### Monitor All Devices

```bash
#!/bin/bash
# monitor_all.sh

DEVICES=(0 1 2 3)

for id in "${DEVICES[@]}"; do
    echo "=== Device $id ==="
    npu-smi info -t health -i $id
    npu-smi info -t temperature -i $id -c 0
    npu-smi info -t power -i $id -c 0
    npu-smi info -t memory -i $id -c 0
done
```
