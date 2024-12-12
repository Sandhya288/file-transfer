const app = Vue.createApp({
    data() {
        return {
            constructorName: "",
            location: "",
            projectSiteName: "",
            modeOfPayment: "",
            date: "",
            amount: null,
            successMessage: "",
            errorMessage: "",
        };
    },
    methods: {
        async submitPayment() {
            try {
                const response = await fetch("/payment", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        constructorName: this.constructorName,
                        location: this.location,
                        projectSiteName: this.projectSiteName,
                        modeOfPayment: this.modeOfPayment,
                        date: this.date,
                        amount: this.amount,
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    this.successMessage = result.message;
                    this.errorMessage = "";
                    // Clear the form fields
                    this.constructorName = "";
                    this.location = "";
                    this.projectSiteName = "";
                    this.modeOfPayment = "";
                    this.date = "";
                    this.amount = null;
                } else {
                    this.successMessage = "";
                    this.errorMessage = result.message || "An error occurred.";
                }
            } catch (error) {
                console.error("Error submitting payment:", error);
                this.successMessage = "";
                this.errorMessage = "An error occurred. Please try again later.";
            }
        },
    },
});

app.mount("#app");