(function () {
  "use strict";

  // ============================================
  // Theme Toggle
  // ============================================
  function initThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) return;

    const iconSun = themeToggle.querySelector(".icon-sun");
    const iconMoon = themeToggle.querySelector(".icon-moon");

    function setTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);

      if (iconSun && iconMoon) {
        if (theme === "light") {
          iconSun.style.display = "none";
          iconMoon.style.display = "block";
        } else {
          iconSun.style.display = "block";
          iconMoon.style.display = "none";
        }
      }
    }

    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);

    themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      setTheme(currentTheme === "dark" ? "light" : "dark");
    });
  }

  // ============================================
  // 3D Tilt Effect
  // ============================================
  function initTiltEffect() {
    document.querySelectorAll(".glass-card-3d").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform =
          "perspective(1000px) rotateX(0) rotateY(0) translateZ(0)";
      });
    });
  }

  // ============================================
  // Animated Counters
  // ============================================
  function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * easeOut);

      if (element.dataset.prefix) {
        element.textContent =
          element.dataset.prefix +
          current.toLocaleString() +
          (element.dataset.suffix || "");
      } else {
        element.textContent =
          current.toLocaleString() + (element.dataset.suffix || "");
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function initCounters() {
    const counters = document.querySelectorAll(".stat-value");
    counters.forEach((counter) => {
      const text = counter.textContent;
      const value = parseInt(text.replace(/[^0-9]/g, ""));

      if (text.includes("$")) {
        counter.dataset.prefix = "$";
      }
      if (text.includes("%")) {
        counter.dataset.suffix = "%";
      }

      animateCounter(counter, value);
    });
  }

  // ============================================
  // Mobile Menu Toggle
  // ============================================
  function initMobileMenu() {
    var menuToggle = document.querySelector(".mobile-menu-toggle");
    var sidebar = document.getElementById("sidebar");
    var overlay = document.querySelector(".sidebar-overlay");

    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", function() {
        sidebar.classList.toggle("open");
        if (overlay) {
          overlay.classList.toggle("active");
        }
      });

      if (overlay) {
        overlay.addEventListener("click", function() {
          sidebar.classList.remove("open");
          overlay.classList.remove("active");
        });
      }

      document.addEventListener("click", function(e) {
        if (
          sidebar.classList.contains("open") &&
          !sidebar.contains(e.target) &&
          !menuToggle.contains(e.target)
        ) {
          sidebar.classList.remove("open");
          if (overlay) {
            overlay.classList.remove("active");
          }
        }
      });
    }
  }

  // ============================================
  // Form Validation (for login/register)
  // ============================================
  function initFormValidation() {
    const forms = document.querySelectorAll("form[data-validate]");

    forms.forEach((form) => {
      form.addEventListener("submit", (e) => {
        // e.preventDefault();

        let isValid = true;
        const inputs = form.querySelectorAll(".form-input[required]");

        inputs.forEach((input) => {
          if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = "#ff6b6b";
          } else {
            input.style.borderColor = "";
          }
        });

        // Email validation
        const emailInput = form.querySelector('input[type="email"]');
        if (emailInput && emailInput.value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailInput.value)) {
            isValid = false;
            emailInput.style.borderColor = "#ff6b6b";
          }
        }

        if (!isValid) {
          e.preventDefault();
        }
      });
    });
  }

  // ============================================
  // Password Visibility Toggle
  // ============================================
  function initPasswordToggle() {
    const toggleButtons = document.querySelectorAll(".password-toggle");

    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement.querySelector("input");
        const icon = button.querySelector("svg");

        if (input.type === "password") {
          input.type = "text";
          icon.innerHTML =
            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
          input.type = "password";
          icon.innerHTML =
            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    });
  }

  // ============================================
  // Smooth Page Transitions
  // ============================================
  function initPageTransitions() {
    const links = document.querySelectorAll('a[href$=".html"]');

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        // Skip external links
        if (link.hostname !== window.location.hostname) return;

        e.preventDefault();
        const href = link.getAttribute("href");

        document.body.style.opacity = "0";
        document.body.style.transition = "opacity 0.3s ease";

        setTimeout(() => {
          window.location.href = href;
        }, 300);
      });
    });

    // Fade in on page load
    window.addEventListener("load", () => {
      document.body.style.opacity = "1";
    });
  }

  // ============================================
  // Settings Tab Navigation
  // ============================================
  function initSettingsTabs() {
    const tabLinks = document.querySelectorAll(".settings-nav-link[data-tab]");

    if (tabLinks.length === 0) return;

    tabLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();

        // Get target tab
        const tabId = link.getAttribute("data-tab");

        // Remove active class from all nav links
        document.querySelectorAll(".settings-nav-link").forEach((navLink) => {
          navLink.classList.remove("active");
        });

        // Add active class to clicked link
        link.classList.add("active");

        // Hide all tab contents
        document.querySelectorAll(".settings-tab-content").forEach((tab) => {
          tab.classList.remove("active");
        });

        // Show target tab content
        const targetTab = document.getElementById("tab-" + tabId);
        if (targetTab) {
          targetTab.classList.add("active");
        }
      });
    });

    // Theme select sync with toggle
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
      const currentTheme = localStorage.getItem("theme") || "dark";
      themeSelect.value = currentTheme;

      themeSelect.addEventListener("change", () => {
        const theme = themeSelect.value;
        if (theme === "system") {
          const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
          ).matches;
          document.documentElement.setAttribute(
            "data-theme",
            prefersDark ? "dark" : "light",
          );
        } else {
          document.documentElement.setAttribute("data-theme", theme);
          localStorage.setItem("theme", theme);
        }

        // Update theme toggle icons
        const iconSun = document.querySelector("#theme-toggle .icon-sun");
        const iconMoon = document.querySelector("#theme-toggle .icon-moon");
        if (iconSun && iconMoon) {
          const effectiveTheme =
            document.documentElement.getAttribute("data-theme");
          if (effectiveTheme === "light") {
            iconSun.style.display = "none";
            iconMoon.style.display = "block";
          } else {
            iconSun.style.display = "block";
            iconMoon.style.display = "none";
          }
        }
      });
    }
  }

  // ============================================
  // Product Search
  // ============================================
  function initProductSearch() {
    const searchInput = document.getElementById("productSearch");
    if (!searchInput) return;

    searchInput.addEventListener(
      "input",
      debounce((e) => {
        const query = e.target.value.toLowerCase();
        const productCards = document.querySelectorAll(".product-card");

        productCards.forEach((card) => {
          const title = card.querySelector(".product-card-title");
          const category = card.querySelector(".product-card-category");
          const text =
            (title?.textContent || "") + (category?.textContent || "");

          if (text.toLowerCase().includes(query)) {
            card.style.display = "";
          } else {
            card.style.display = "none";
          }
        });
      }, 300),
    );
  }

  // ============================================
  // Category Filter
  // ============================================
  function initCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");
    if (!categoryFilter) return;

    categoryFilter.addEventListener("change", (e) => {
      const filter = e.target.value;
      const productCards = document.querySelectorAll(".product-card");

      productCards.forEach((card) => {
        const badge = card.querySelector(".product-badge");
        const isAvailable = badge?.classList.contains("available");

        if (filter === "available" && isAvailable) {
          card.style.display = "";
        } else if (filter === "outOfStock" && !isAvailable) {
          card.style.display = "";
        } else if (filter === "") {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  }

  // ============================================
  // View Toggle (Grid/List)
  // ============================================
  function initViewToggle() {
    const viewBtns = document.querySelectorAll(".view-btn");
    const gridView = document.getElementById("productsGrid");

    if (viewBtns.length === 0 || !gridView) return;

    viewBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;

        viewBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (view === "list") {
          gridView.classList.add("list-view");
        } else {
          gridView.classList.remove("list-view");
        }
      });
    });
  }

  // ============================================
  // Lead Status Update
  // ============================================
  function initLeadActions() {
    window.updateLeadStatus = async (leadId, status) => {
      try {
        const response = await fetch(`/leads/${leadId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (response.ok) {
          showNotification("Lead updated successfully!", "success");
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showNotification("Failed to update lead", "error");
        }
      } catch (err) {
        showNotification("Error updating lead", "error");
      }
    };
  }

  // ============================================
  // Product Actions
  // ============================================
  function initProductActions() {
    window.deleteProduct = async (productId) => {
      if (!confirm("Are you sure you want to delete this product?")) return;

      try {
        const response = await fetch(`/products/${productId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          showNotification("Product deleted successfully!", "success");
          setTimeout(() => window.location.reload(), 1000);
        } else {
          const data = await response.json();
          showNotification(data.error || "Failed to delete product", "error");
        }
      } catch (err) {
        showNotification("Error deleting product", "error");
      }
    };

    window.broadcastProduct = async (productId) => {
      try {
        const response = await fetch(`/products/${productId}/broadcast`, {
          method: "POST",
        });

        const data = await response.json();
        if (response.ok) {
          showNotification(data.message || "Broadcast sent!", "success");
        } else {
          showNotification(data.error || "Failed to broadcast", "error");
        }
      } catch (err) {
        showNotification("Error broadcasting product", "error");
      }
    };

    window.postToStatus = async (productId) => {
      try {
        const response = await fetch(`/products/${productId}/status`, {
          method: "POST",
        });

        const data = await response.json();
        if (response.ok) {
          showNotification(data.message || "Posted to status!", "success");
        } else {
          showNotification(data.error || "Failed to post to status", "error");
        }
      } catch (err) {
        showNotification("Error posting to status", "error");
      }
    };
  }

  // ============================================
  // Settings Forms
  // ============================================
  function initSettingsForms() {
    const settingsForm = document.querySelector("#tab-profile form");
    const securityForm = document.querySelector("#tab-security form");

    if (settingsForm) {
      settingsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        const data = Object.fromEntries(formData);

        try {
          const response = await fetch("/settings/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            showNotification("Profile updated successfully!", "success");
          } else {
            showNotification("Failed to update profile", "error");
          }
        } catch (err) {
          showNotification("Error updating profile", "error");
        }
      });
    }

    if (securityForm) {
      securityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(securityForm);
        const data = Object.fromEntries(formData);

        if (data.newPassword !== data.confirmPassword) {
          showNotification("Passwords do not match!", "error");
          return;
        }

        try {
          const response = await fetch("/settings/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            showNotification("Password updated successfully!", "success");
            securityForm.reset();
          } else {
            showNotification("Failed to update password", "error");
          }
        } catch (err) {
          showNotification("Error updating password", "error");
        }
      });
    }
  }

  // ============================================
  // Lead Search & Filter
  // ============================================
  function initLeadSearch() {
    const searchInput = document.getElementById("leadSearch");
    if (!searchInput) return;

    searchInput.addEventListener(
      "input",
      debounce((e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll(".data-table tbody tr");

        rows.forEach((row) => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(query) ? "" : "none";
        });
      }, 300),
    );
  }

  // ============================================
  // Lead Filter
  // ============================================
  function initLeadFilter() {
    const statusFilter = document.getElementById("leadStatusFilter");
    if (!statusFilter) return;

    statusFilter.addEventListener("change", (e) => {
      const filter = e.target.value;
      const rows = document.querySelectorAll(".data-table tbody tr");

      rows.forEach((row) => {
        const statusBadge = row.querySelector(".status-badge");
        const status = statusBadge?.textContent?.trim().toLowerCase();

        if (filter === "" || status === filter) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  }

  // ============================================
  // Notification System
  // ============================================
  function showNotification(message, type = "info") {
    const existing = document.querySelector(".notification-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ============================================
  // Utility: Debounce
  // ============================================
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ============================================
  // WhatsApp Instruction Modal
  // ============================================
  window.showWhatsAppInstructions = function(e) {
    if (e) {
      e.preventDefault();
    }
    var modal = document.getElementById("wa-instructions-modal");
    if (modal) {
      modal.classList.remove("hidden");
      setTimeout(function() { modal.classList.add("active"); }, 10);
    }
  };

  window.closeWhatsAppModal = function() {
    var modal = document.getElementById("wa-instructions-modal");
    if (modal) {
      modal.classList.remove("active");
      setTimeout(function() { modal.classList.add("hidden"); }, 300);
    }
  };

  window.proceedToWhatsApp = function() {
    window.location.href = "/whatsapp/connect-whatsapp";
  };

  function initWhatsAppModal() {
    var modal = document.getElementById("wa-instructions-modal");
    if (modal) {
      modal.addEventListener("click", function(e) {
        if (e.target === modal) {
          window.closeWhatsAppModal();
        }
      });
    }
  }

  // ============================================
  // Mobile Navigation Active State
  // ============================================
  function initMobileNav() {
    var path = window.location.pathname;
    var navItems = document.querySelectorAll(".mobile-nav-item");
    navItems.forEach(function(item) {
      var href = item.getAttribute("href");
      if (href && path === href) {
        item.classList.add("active");
      }
    });
  }

  // ============================================
  // Initialize All Functions
  // ============================================
  function init() {
    initThemeToggle();
    initTiltEffect();
    initCounters();
    initMobileMenu();
    initFormValidation();
    initPasswordToggle();
    initPageTransitions();
    initSettingsTabs();
    initProductSearch();
    initCategoryFilter();
    initViewToggle();
    initLeadActions();
    initProductActions();
    initSettingsForms();
    initLeadSearch();
    initLeadFilter();
    initWhatsAppModal();
    initMobileNav();
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
